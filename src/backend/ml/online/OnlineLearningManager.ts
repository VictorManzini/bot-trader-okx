/**
 * Online Learning Manager
 * Sistema de aprendizado contínuo que atualiza modelos em tempo real
 */

import { MLPipeline, ModelType, PredictionEnsemble } from '../features/MLPipeline';
import { MultiTimeframeData } from '../features/FeatureEngineering';
import { PredictionRecord, TrainingWindow, OnlineLearningConfig } from './types';
import { PredictionLogger } from './PredictionLogger';
import { ModelUpdater } from './ModelUpdater';
import { PerformanceTracker } from './PerformanceTracker';

export class OnlineLearningManager {
  private mlPipeline: MLPipeline;
  private predictionLogger: PredictionLogger;
  private modelUpdater: ModelUpdater;
  private performanceTracker: PerformanceTracker;
  private config: OnlineLearningConfig;
  private isUpdating: boolean = false;
  private lastUpdateTimestamp: number = 0;

  constructor(mlPipeline: MLPipeline, config?: Partial<OnlineLearningConfig>) {
    this.mlPipeline = mlPipeline;
    
    this.config = {
      updateFrequency: config?.updateFrequency || 'candle', // 'candle' | 'window' | 'manual'
      windowSize: config?.windowSize || 100, // Número de candles para retreinar
      minSamplesForUpdate: config?.minSamplesForUpdate || 50,
      updateInterval: config?.updateInterval || 3600000, // 1 hora em ms
      enableAutoRetrain: config?.enableAutoRetrain !== undefined ? config.enableAutoRetrain : true,
      performanceThreshold: config?.performanceThreshold || 0.55, // Accuracy mínima
      maxPredictionHistory: config?.maxPredictionHistory || 10000,
      modelTypes: config?.modelTypes || ['LSTM', 'XGBoost'],
    };

    this.predictionLogger = new PredictionLogger(this.config.maxPredictionHistory);
    this.modelUpdater = new ModelUpdater(mlPipeline, this.config);
    this.performanceTracker = new PerformanceTracker();

    console.log('🧠 Online Learning Manager inicializado');
    console.log(`📊 Configuração: ${this.config.updateFrequency} | Window: ${this.config.windowSize}`);
  }

  /**
   * Registra uma nova previsão feita pelo modelo
   */
  async logPrediction(
    prediction: PredictionEnsemble,
    currentPrice: number,
    symbol: string,
    timeframe: string
  ): Promise<string> {
    const record: PredictionRecord = {
      id: this.generatePredictionId(),
      timestamp: Date.now(),
      symbol,
      timeframe,
      currentPrice,
      prediction: prediction.direction,
      confidence: prediction.confidence,
      modelPredictions: prediction.predictions,
      actualPrice: null,
      actualDirection: null,
      isCorrect: null,
      pnl: null,
      pnlPercentage: null,
      evaluatedAt: null,
    };

    this.predictionLogger.addPrediction(record);
    console.log(`📝 Previsão registrada: ${record.id} | ${prediction.direction} (${(prediction.confidence * 100).toFixed(2)}%)`);

    return record.id;
  }

  /**
   * Atualiza uma previsão com o resultado real
   */
  async evaluatePrediction(
    predictionId: string,
    actualPrice: number
  ): Promise<void> {
    const record = this.predictionLogger.getPrediction(predictionId);
    if (!record) {
      console.warn(`⚠️ Previsão ${predictionId} não encontrada`);
      return;
    }

    // Calcular direção real
    const priceChange = actualPrice - record.currentPrice;
    const priceChangePercent = (priceChange / record.currentPrice) * 100;

    let actualDirection: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
    if (priceChangePercent > 0.5) actualDirection = 'UP';
    else if (priceChangePercent < -0.5) actualDirection = 'DOWN';

    // Verificar se a previsão estava correta
    const isCorrect = record.prediction === actualDirection;

    // Calcular PnL (simulado)
    const pnl = priceChange;
    const pnlPercentage = priceChangePercent;

    // Atualizar registro
    record.actualPrice = actualPrice;
    record.actualDirection = actualDirection;
    record.isCorrect = isCorrect;
    record.pnl = pnl;
    record.pnlPercentage = pnlPercentage;
    record.evaluatedAt = Date.now();

    this.predictionLogger.updatePrediction(record);

    // Atualizar métricas de performance
    this.performanceTracker.addResult({
      timestamp: Date.now(),
      isCorrect,
      pnl,
      pnlPercentage,
      confidence: record.confidence,
      prediction: record.prediction,
      actual: actualDirection,
    });

    console.log(`✅ Previsão avaliada: ${predictionId} | ${isCorrect ? '✓' : '✗'} | PnL: ${pnlPercentage.toFixed(2)}%`);

    // Verificar se precisa atualizar modelos
    await this.checkAndUpdateModels();
  }

  /**
   * Processa um novo candle e decide se precisa atualizar modelos
   */
  async processNewCandle(
    multiTimeframeData: MultiTimeframeData,
    symbol: string,
    timeframe: string
  ): Promise<void> {
    console.log(`📊 Processando novo candle: ${symbol} ${timeframe}`);

    // Se configurado para atualizar a cada candle
    if (this.config.updateFrequency === 'candle' && this.config.enableAutoRetrain) {
      await this.checkAndUpdateModels(multiTimeframeData);
    }
  }

  /**
   * Verifica se é necessário atualizar os modelos
   */
  private async checkAndUpdateModels(
    multiTimeframeData?: MultiTimeframeData
  ): Promise<void> {
    if (this.isUpdating) {
      console.log('⏳ Atualização já em andamento, pulando...');
      return;
    }

    // Verificar se tem amostras suficientes
    const evaluatedPredictions = this.predictionLogger.getEvaluatedPredictions();
    if (evaluatedPredictions.length < this.config.minSamplesForUpdate) {
      console.log(`📊 Amostras insuficientes: ${evaluatedPredictions.length}/${this.config.minSamplesForUpdate}`);
      return;
    }

    // Verificar intervalo de tempo
    const timeSinceLastUpdate = Date.now() - this.lastUpdateTimestamp;
    if (this.config.updateFrequency === 'window' && timeSinceLastUpdate < this.config.updateInterval) {
      return;
    }

    // Verificar performance
    const performance = this.performanceTracker.getOverallPerformance();
    if (performance.accuracy < this.config.performanceThreshold) {
      console.log(`⚠️ Performance abaixo do threshold: ${(performance.accuracy * 100).toFixed(2)}% < ${(this.config.performanceThreshold * 100).toFixed(2)}%`);
      console.log('🔄 Iniciando retreinamento dos modelos...');
      
      if (multiTimeframeData) {
        await this.updateModels(multiTimeframeData);
      }
    } else {
      console.log(`✅ Performance adequada: ${(performance.accuracy * 100).toFixed(2)}%`);
    }
  }

  /**
   * Atualiza (retreina) os modelos com dados recentes
   */
  async updateModels(multiTimeframeData: MultiTimeframeData): Promise<void> {
    if (this.isUpdating) {
      console.log('⏳ Atualização já em andamento');
      return;
    }

    this.isUpdating = true;
    console.log('🔄 Iniciando atualização dos modelos...');

    try {
      // Pegar janela de dados recentes
      const recentPredictions = this.predictionLogger.getRecentPredictions(this.config.windowSize);
      console.log(`📊 Usando ${recentPredictions.length} previsões recentes para retreinamento`);

      // Retreinar cada modelo
      for (const modelType of this.config.modelTypes) {
        console.log(`🔧 Atualizando modelo ${modelType}...`);
        
        try {
          await this.modelUpdater.updateModel(
            modelType,
            multiTimeframeData,
            recentPredictions
          );
          
          console.log(`✅ Modelo ${modelType} atualizado com sucesso`);
        } catch (error) {
          console.error(`❌ Erro ao atualizar modelo ${modelType}:`, error);
        }
      }

      this.lastUpdateTimestamp = Date.now();
      console.log('✅ Atualização de modelos concluída');

      // Limpar histórico antigo se necessário
      this.predictionLogger.cleanOldPredictions(this.config.maxPredictionHistory);

    } catch (error) {
      console.error('❌ Erro na atualização dos modelos:', error);
      throw error;
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Força atualização manual dos modelos
   */
  async forceUpdate(multiTimeframeData: MultiTimeframeData): Promise<void> {
    console.log('🔄 Atualização manual forçada');
    await this.updateModels(multiTimeframeData);
  }

  /**
   * Retorna estatísticas de performance
   */
  getPerformanceStats(): {
    overall: any;
    byModel: Map<ModelType, any>;
    recentPredictions: number;
    totalPredictions: number;
    lastUpdate: number;
  } {
    return {
      overall: this.performanceTracker.getOverallPerformance(),
      byModel: this.performanceTracker.getPerformanceByModel(),
      recentPredictions: this.predictionLogger.getEvaluatedPredictions().length,
      totalPredictions: this.predictionLogger.getTotalPredictions(),
      lastUpdate: this.lastUpdateTimestamp,
    };
  }

  /**
   * Retorna histórico de previsões
   */
  getPredictionHistory(limit?: number): PredictionRecord[] {
    return this.predictionLogger.getRecentPredictions(limit || 100);
  }

  /**
   * Exporta dados de treinamento para análise
   */
  exportTrainingData(): {
    predictions: PredictionRecord[];
    performance: any;
    config: OnlineLearningConfig;
  } {
    return {
      predictions: this.predictionLogger.getAllPredictions(),
      performance: this.performanceTracker.getOverallPerformance(),
      config: this.config,
    };
  }

  /**
   * Reseta o sistema de aprendizado contínuo
   */
  reset(): void {
    this.predictionLogger.clear();
    this.performanceTracker.reset();
    this.lastUpdateTimestamp = 0;
    console.log('🔄 Online Learning Manager resetado');
  }

  /**
   * Gera ID único para previsão
   */
  private generatePredictionId(): string {
    return `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Retorna configuração atual
   */
  getConfig(): OnlineLearningConfig {
    return { ...this.config };
  }

  /**
   * Atualiza configuração
   */
  updateConfig(newConfig: Partial<OnlineLearningConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.modelUpdater.updateConfig(this.config);
    console.log('⚙️ Configuração atualizada:', newConfig);
  }
}
