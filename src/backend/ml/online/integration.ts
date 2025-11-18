/**
 * Integração do Online Learning com o Bot Trader
 * Este arquivo demonstra como integrar o sistema de aprendizado contínuo
 * com o bot trader principal
 */

import { MLPipeline } from '../features/MLPipeline';
import { OnlineLearningManager } from './OnlineLearningManager';
import { FeatureEngineering, MultiTimeframeData, OHLCVData } from '../features/FeatureEngineering';

/**
 * Classe de integração principal
 */
export class BotTraderMLIntegration {
  private mlPipeline: MLPipeline;
  private onlineLearning: OnlineLearningManager;
  private featureEngineering: FeatureEngineering;
  private isInitialized: boolean = false;
  private pendingPredictions: Map<string, {
    price: number;
    timestamp: number;
    candles: number;
  }>;

  constructor() {
    this.mlPipeline = new MLPipeline({
      modelType: 'LSTM',
      sequenceLength: 60,
      lookAhead: 1,
    });

    this.featureEngineering = new FeatureEngineering();
    this.pendingPredictions = new Map();

    // Configuração padrão do online learning
    this.onlineLearning = new OnlineLearningManager(this.mlPipeline, {
      updateFrequency: 'window',
      windowSize: 100,
      minSamplesForUpdate: 50,
      updateInterval: 3600000, // 1 hora
      enableAutoRetrain: true,
      performanceThreshold: 0.55,
      maxPredictionHistory: 10000,
      modelTypes: ['LSTM', 'XGBoost', 'GRU'],
    });
  }

  /**
   * Inicializa o sistema de ML
   */
  async initialize(modelTypes: Array<'LSTM' | 'GRU' | 'Transformer' | 'TCN' | 'XGBoost' | 'CNN'> = ['LSTM', 'XGBoost', 'GRU']): Promise<void> {
    console.log('🚀 Inicializando sistema de ML...');

    try {
      // Inicializar modelos
      this.mlPipeline.initializeModels(modelTypes);

      this.isInitialized = true;
      console.log('✅ Sistema de ML inicializado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao inicializar sistema de ML:', error);
      throw error;
    }
  }

  /**
   * Treina os modelos inicialmente com dados históricos
   */
  async trainInitialModels(historicalData: MultiTimeframeData): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Sistema não foi inicializado. Chame initialize() primeiro.');
    }

    console.log('📚 Treinando modelos com dados históricos...');

    try {
      // Treinar cada modelo
      const modelTypes = Array.from(this.mlPipeline.getModelsInfo().keys());
      
      for (const modelType of modelTypes) {
        console.log(`🔧 Treinando ${modelType}...`);
        await this.mlPipeline.trainModel(modelType, historicalData);
      }

      console.log('✅ Treinamento inicial concluído');
    } catch (error) {
      console.error('❌ Erro no treinamento inicial:', error);
      throw error;
    }
  }

  /**
   * Obtém previsão de ML para decisão de trade
   * Esta função deve ser chamada pelo bot trader antes de executar uma operação
   */
  async getPredictionForTrade(
    multiTimeframeData: MultiTimeframeData,
    currentPrice: number,
    symbol: string,
    timeframe: string
  ): Promise<{
    shouldTrade: boolean;
    direction: 'LONG' | 'SHORT' | 'NEUTRAL';
    confidence: number;
    predictionId: string;
    details: {
      prediction: 'UP' | 'DOWN' | 'NEUTRAL';
      modelPredictions: any[];
      timestamp: number;
    };
  }> {
    if (!this.isInitialized) {
      throw new Error('Sistema não foi inicializado');
    }

    try {
      // 1. Fazer previsão ensemble
      const prediction = await this.mlPipeline.predictEnsemble(multiTimeframeData);

      // 2. Registrar previsão para aprendizado contínuo
      const predictionId = await this.onlineLearning.logPrediction(
        prediction,
        currentPrice,
        symbol,
        timeframe
      );

      // 3. Guardar para avaliar depois
      this.pendingPredictions.set(predictionId, {
        price: currentPrice,
        timestamp: Date.now(),
        candles: 0,
      });

      // 4. Determinar se deve tradear
      const shouldTrade = prediction.confidence >= 0.6; // Threshold de confiança
      
      let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
      if (prediction.direction === 'UP') direction = 'LONG';
      else if (prediction.direction === 'DOWN') direction = 'SHORT';

      console.log(`🔮 Previsão: ${direction} | Confiança: ${(prediction.confidence * 100).toFixed(2)}% | Trade: ${shouldTrade ? 'SIM' : 'NÃO'}`);

      return {
        shouldTrade,
        direction,
        confidence: prediction.confidence,
        predictionId,
        details: {
          prediction: prediction.direction,
          modelPredictions: prediction.predictions,
          timestamp: prediction.timestamp,
        },
      };
    } catch (error) {
      console.error('❌ Erro ao obter previsão:', error);
      throw error;
    }
  }

  /**
   * Processa novo candle
   * Deve ser chamado a cada novo candle recebido
   */
  async processNewCandle(
    multiTimeframeData: MultiTimeframeData,
    currentPrice: number,
    symbol: string,
    timeframe: string
  ): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // 1. Incrementar contador de candles para previsões pendentes
      for (const [predId, data] of this.pendingPredictions) {
        data.candles++;
      }

      // 2. Avaliar previsões que já passaram tempo suficiente (5 candles)
      const toEvaluate: string[] = [];
      for (const [predId, data] of this.pendingPredictions) {
        if (data.candles >= 5) {
          toEvaluate.push(predId);
        }
      }

      for (const predId of toEvaluate) {
        await this.onlineLearning.evaluatePrediction(predId, currentPrice);
        this.pendingPredictions.delete(predId);
      }

      // 3. Processar novo candle (pode triggerar retreinamento)
      await this.onlineLearning.processNewCandle(
        multiTimeframeData,
        symbol,
        timeframe
      );

    } catch (error) {
      console.error('❌ Erro ao processar novo candle:', error);
    }
  }

  /**
   * Retorna estatísticas de performance
   */
  getPerformanceStats(): {
    overall: any;
    byModel: Map<string, any>;
    recentPredictions: number;
    totalPredictions: number;
    lastUpdate: number;
  } {
    return this.onlineLearning.getPerformanceStats();
  }

  /**
   * Retorna histórico de previsões
   */
  getPredictionHistory(limit: number = 100): any[] {
    return this.onlineLearning.getPredictionHistory(limit);
  }

  /**
   * Força atualização dos modelos
   */
  async forceModelUpdate(multiTimeframeData: MultiTimeframeData): Promise<void> {
    console.log('🔄 Forçando atualização dos modelos...');
    await this.onlineLearning.forceUpdate(multiTimeframeData);
  }

  /**
   * Exporta dados de treinamento
   */
  exportTrainingData(): any {
    return this.onlineLearning.exportTrainingData();
  }

  /**
   * Atualiza configuração do online learning
   */
  updateConfig(config: any): void {
    this.onlineLearning.updateConfig(config);
  }

  /**
   * Reseta o sistema de aprendizado
   */
  reset(): void {
    this.onlineLearning.reset();
    this.pendingPredictions.clear();
  }

  /**
   * Verifica se o sistema está pronto
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

/**
 * EXEMPLO DE USO NO BOT TRADER
 */

/*
// No arquivo principal do bot trader:

import { BotTraderMLIntegration } from './backend/ml/online/integration';

class BotTrader {
  private mlIntegration: BotTraderMLIntegration;

  constructor() {
    this.mlIntegration = new BotTraderMLIntegration();
  }

  async initialize() {
    // Inicializar ML
    await this.mlIntegration.initialize(['LSTM', 'XGBoost', 'GRU']);

    // Treinar com dados históricos
    const historicalData = await this.fetchHistoricalData();
    await this.mlIntegration.trainInitialModels(historicalData);
  }

  async onNewCandle(candleData: any) {
    // 1. Atualizar dados multi-timeframe
    const multiTimeframeData = this.buildMultiTimeframeData(candleData);
    const currentPrice = candleData.close;

    // 2. Processar novo candle (aprendizado contínuo)
    await this.mlIntegration.processNewCandle(
      multiTimeframeData,
      currentPrice,
      'BTC-USDT',
      '1m'
    );

    // 3. Obter previsão de ML
    const mlPrediction = await this.mlIntegration.getPredictionForTrade(
      multiTimeframeData,
      currentPrice,
      'BTC-USDT',
      '1m'
    );

    // 4. Combinar com análise técnica tradicional
    const technicalAnalysis = this.analyzeTechnicalIndicators(candleData);

    // 5. Decidir se vai tradear
    if (mlPrediction.shouldTrade && mlPrediction.confidence > 0.65) {
      if (mlPrediction.direction === 'LONG' && technicalAnalysis.bullish) {
        await this.executeLongTrade(currentPrice);
      } else if (mlPrediction.direction === 'SHORT' && technicalAnalysis.bearish) {
        await this.executeShortTrade(currentPrice);
      }
    }

    // 6. Monitorar performance periodicamente
    if (this.shouldLogPerformance()) {
      const stats = this.mlIntegration.getPerformanceStats();
      console.log('ML Performance:', stats.overall.accuracy);
    }
  }

  async executeLongTrade(price: number) {
    // Lógica de execução de trade long
  }

  async executeShortTrade(price: number) {
    // Lógica de execução de trade short
  }
}
*/

/**
 * EXEMPLO DE MONITORAMENTO
 */

/*
// Monitorar performance a cada 10 minutos
setInterval(async () => {
  const stats = mlIntegration.getPerformanceStats();
  
  console.log('📊 === ML PERFORMANCE ===');
  console.log('Accuracy:', (stats.overall.accuracy * 100).toFixed(2) + '%');
  console.log('Win Rate:', (stats.overall.winRate * 100).toFixed(2) + '%');
  console.log('Avg PnL:', stats.overall.avgPnlPercentage.toFixed(2) + '%');
  console.log('Sharpe Ratio:', stats.overall.sharpeRatio.toFixed(2));
  
  // Alertar se performance baixa
  if (stats.overall.accuracy < 0.50) {
    console.warn('⚠️ ALERTA: Performance ML abaixo de 50%!');
    // Considerar retreinamento forçado
    await mlIntegration.forceModelUpdate(currentData);
  }
}, 600000);
*/

/**
 * EXEMPLO DE BACKUP DE DADOS
 */

/*
// Fazer backup diário dos dados de treinamento
setInterval(() => {
  const data = mlIntegration.exportTrainingData();
  
  fs.writeFileSync(
    `./backups/ml_training_${Date.now()}.json`,
    JSON.stringify(data, null, 2)
  );
  
  console.log('💾 Backup de dados ML salvo');
}, 86400000); // 24 horas
*/
