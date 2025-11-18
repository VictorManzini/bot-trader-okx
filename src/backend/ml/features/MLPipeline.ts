/**
 * Pipeline Integrado de ML
 * Conecta Feature Engineering com os modelos de ML
 */

import { FeatureEngineering, OHLCVData, MultiTimeframeData, AdvancedFeatures } from './FeatureEngineering';
import { DataPreparation, NormalizationParams } from './DataPreparation';
import { LSTMModel } from '../models/LSTMModel';
import { GRUModel } from '../models/GRUModel';
import { TransformerModel } from '../models/TransformerModel';
import { TCNModel } from '../models/TCNModel';
import { XGBoostModel, TechnicalFeatures } from '../models/XGBoostModel';
import { CNNPatternModel } from '../models/CNNPatternModel';

export type ModelType = 'LSTM' | 'GRU' | 'Transformer' | 'TCN' | 'XGBoost' | 'CNN';

export interface PipelineConfig {
  modelType: ModelType;
  sequenceLength: number;
  lookAhead: number;
  normalizationMethod: 'zscore' | 'minmax';
  balanceClasses: boolean;
  removeOutliers: boolean;
}

export interface PredictionEnsemble {
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
  predictions: Array<{
    model: ModelType;
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    confidence: number;
    predictedPrice?: number;
  }>;
  timestamp: number;
}

export class MLPipeline {
  private featureEngineering: FeatureEngineering;
  private dataPreparation: DataPreparation;
  private models: Map<ModelType, any>;
  private normalizationParams: NormalizationParams | null = null;
  private config: PipelineConfig;

  constructor(config?: Partial<PipelineConfig>) {
    this.featureEngineering = new FeatureEngineering();
    this.dataPreparation = new DataPreparation();
    this.models = new Map();
    
    this.config = {
      modelType: config?.modelType || 'LSTM',
      sequenceLength: config?.sequenceLength || 60,
      lookAhead: config?.lookAhead || 1,
      normalizationMethod: config?.normalizationMethod || 'zscore',
      balanceClasses: config?.balanceClasses !== undefined ? config.balanceClasses : true,
      removeOutliers: config?.removeOutliers !== undefined ? config.removeOutliers : false,
    };
  }

  /**
   * Inicializa modelos
   */
  initializeModels(modelTypes: ModelType[]): void {
    console.log('🔧 Inicializando modelos de ML...');

    for (const modelType of modelTypes) {
      switch (modelType) {
        case 'LSTM':
          this.models.set('LSTM', new LSTMModel({
            sequenceLength: this.config.sequenceLength,
          }));
          break;
        case 'GRU':
          this.models.set('GRU', new GRUModel({
            sequenceLength: this.config.sequenceLength,
          }));
          break;
        case 'Transformer':
          this.models.set('Transformer', new TransformerModel({
            sequenceLength: this.config.sequenceLength,
          }));
          break;
        case 'TCN':
          this.models.set('TCN', new TCNModel({
            sequenceLength: this.config.sequenceLength,
          }));
          break;
        case 'XGBoost':
          this.models.set('XGBoost', new XGBoostModel());
          break;
        case 'CNN':
          this.models.set('CNN', new CNNPatternModel({
            sequenceLength: this.config.sequenceLength,
          }));
          break;
      }
    }

    console.log(`✅ ${modelTypes.length} modelos inicializados`);
  }

  /**
   * Prepara dados para treinamento
   */
  prepareTrainingData(multiTimeframeData: MultiTimeframeData, primaryTimeframe: keyof MultiTimeframeData = '1m'): {
    X: number[][];
    y: number[];
    features: AdvancedFeatures[];
  } {
    console.log('📊 Preparando dados para treinamento...');

    const data = multiTimeframeData[primaryTimeframe];
    if (!data || data.length < this.config.sequenceLength + this.config.lookAhead) {
      throw new Error('Dados insuficientes para treinamento');
    }

    // Extrair features para cada candle
    const allFeatures: AdvancedFeatures[] = [];
    for (let i = this.config.sequenceLength; i < data.length; i++) {
      const windowData = data.slice(i - this.config.sequenceLength, i);
      const mtfData: MultiTimeframeData = {
        [primaryTimeframe]: windowData,
      };
      
      const features = this.featureEngineering.extractAllFeatures(mtfData, primaryTimeframe);
      allFeatures.push(features);
    }

    // Converter features para arrays numéricos
    const X = allFeatures.map(f => this.featureEngineering.featuresToArray(f));

    // Criar labels (preços futuros)
    const prices = data.map(d => d.close);
    const y = this.dataPreparation.createRegressionLabels(
      prices.slice(this.config.sequenceLength - 1),
      this.config.lookAhead
    );

    console.log(`✅ ${X.length} amostras preparadas`);

    return { X, y, features: allFeatures };
  }

  /**
   * Treina um modelo específico
   */
  async trainModel(
    modelType: ModelType,
    multiTimeframeData: MultiTimeframeData,
    primaryTimeframe: keyof MultiTimeframeData = '1m'
  ): Promise<void> {
    console.log(`🚀 Iniciando treinamento do modelo ${modelType}...`);

    const model = this.models.get(modelType);
    if (!model) {
      throw new Error(`Modelo ${modelType} não foi inicializado`);
    }

    // Preparar dados
    let { X, y } = this.prepareTrainingData(multiTimeframeData, primaryTimeframe);

    // Remover outliers se configurado
    if (this.config.removeOutliers) {
      console.log('🧹 Removendo outliers...');
      const cleaned = this.dataPreparation.removeOutliers(X, y);
      X = cleaned.X;
      y = cleaned.y;
    }

    // Normalizar dados
    console.log(`📐 Normalizando dados (${this.config.normalizationMethod})...`);
    let normalizedData;
    if (this.config.normalizationMethod === 'zscore') {
      normalizedData = this.dataPreparation.zScoreNormalization(X);
    } else {
      normalizedData = this.dataPreparation.minMaxNormalization(X);
    }
    X = normalizedData.normalized;
    this.normalizationParams = normalizedData.params;

    // Dividir em treino/validação/teste
    const split = this.dataPreparation.splitDataset(X, y, 0.7, 0.15, 0.15);

    // Treinar modelo
    if (modelType === 'XGBoost') {
      // XGBoost usa features técnicas diretamente
      const data = multiTimeframeData[primaryTimeframe]!;
      const technicalFeatures: TechnicalFeatures[] = [];
      
      for (let i = this.config.sequenceLength; i < data.length; i++) {
        const windowData = data.slice(i - this.config.sequenceLength, i);
        const mtfData: MultiTimeframeData = { [primaryTimeframe]: windowData };
        const features = this.featureEngineering.extractAllFeatures(mtfData, primaryTimeframe);
        
        technicalFeatures.push({
          rsi: features.indicators.rsi,
          macd: features.indicators.macd,
          macdSignal: features.indicators.macdSignal,
          macdHist: features.indicators.macdHist,
          ema9: features.indicators.ema9,
          ema21: features.indicators.ema21,
          ema50: features.indicators.ema50,
          sma20: features.indicators.sma20,
          sma50: features.indicators.sma50,
          bollingerUpper: features.indicators.bollingerUpper,
          bollingerMiddle: features.indicators.bollingerMiddle,
          bollingerLower: features.indicators.bollingerLower,
          atr: features.volatility.atr,
          adx: features.indicators.adx,
          stochK: features.indicators.stochK,
          stochD: features.indicators.stochD,
          volume: features.ohlcv.volume,
          volumeMA: features.ohlcv.volume, // Simplificado
          priceChange: features.priceDerivatives.priceChange,
          volatility: features.volatility.stdDev,
        });
      }

      // Criar labels de classificação para XGBoost
      const classLabels = this.dataPreparation.createClassificationLabels(
        data.map(d => d.close).slice(this.config.sequenceLength - 1),
        this.config.lookAhead,
        0.5
      );

      await model.train(technicalFeatures.slice(0, split.train.X.length), classLabels);
    } else {
      // Modelos de séries temporais (LSTM, GRU, Transformer, TCN, CNN)
      // Criar sequências 3D
      const trainSequences = this.dataPreparation.createSlidingWindows(
        split.train.X,
        this.config.sequenceLength,
        1
      );
      const trainLabels = split.train.y.map(val => [val]);

      await model.train(trainSequences, trainLabels);
    }

    console.log(`✅ Modelo ${modelType} treinado com sucesso`);
  }

  /**
   * Faz previsão com um modelo específico
   */
  async predictWithModel(
    modelType: ModelType,
    multiTimeframeData: MultiTimeframeData,
    primaryTimeframe: keyof MultiTimeframeData = '1m'
  ): Promise<{
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    confidence: number;
    predictedPrice?: number;
  }> {
    const model = this.models.get(modelType);
    if (!model) {
      throw new Error(`Modelo ${modelType} não foi inicializado`);
    }

    const data = multiTimeframeData[primaryTimeframe];
    if (!data || data.length < this.config.sequenceLength) {
      throw new Error('Dados insuficientes para previsão');
    }

    // Extrair features da janela mais recente
    const recentData = data.slice(-this.config.sequenceLength);
    const mtfData: MultiTimeframeData = { [primaryTimeframe]: recentData };
    const features = this.featureEngineering.extractAllFeatures(mtfData, primaryTimeframe);

    if (modelType === 'XGBoost') {
      // XGBoost usa features técnicas
      const technicalFeatures: TechnicalFeatures = {
        rsi: features.indicators.rsi,
        macd: features.indicators.macd,
        macdSignal: features.indicators.macdSignal,
        macdHist: features.indicators.macdHist,
        ema9: features.indicators.ema9,
        ema21: features.indicators.ema21,
        ema50: features.indicators.ema50,
        sma20: features.indicators.sma20,
        sma50: features.indicators.sma50,
        bollingerUpper: features.indicators.bollingerUpper,
        bollingerMiddle: features.indicators.bollingerMiddle,
        bollingerLower: features.indicators.bollingerLower,
        atr: features.volatility.atr,
        adx: features.indicators.adx,
        stochK: features.indicators.stochK,
        stochD: features.indicators.stochD,
        volume: features.ohlcv.volume,
        volumeMA: features.ohlcv.volume,
        priceChange: features.priceDerivatives.priceChange,
        volatility: features.volatility.stdDev,
      };

      const result = await model.predict(technicalFeatures);
      return {
        direction: result.direction,
        confidence: result.confidence,
      };
    } else {
      // Modelos de séries temporais
      const featureArray = this.featureEngineering.featuresToArray(features);
      
      // Normalizar se parâmetros disponíveis
      let normalizedFeatures = [featureArray];
      if (this.normalizationParams) {
        normalizedFeatures = this.dataPreparation.applyNormalization(
          [featureArray],
          this.normalizationParams,
          this.config.normalizationMethod
        );
      }

      // Criar sequência para o modelo
      const sequence = Array(this.config.sequenceLength).fill(normalizedFeatures[0]);

      const result = await model.predict(sequence);
      return {
        direction: result.direction,
        confidence: result.confidence,
        predictedPrice: result.predictedPrice,
      };
    }
  }

  /**
   * Ensemble de previsões (combina múltiplos modelos)
   */
  async predictEnsemble(
    multiTimeframeData: MultiTimeframeData,
    primaryTimeframe: keyof MultiTimeframeData = '1m'
  ): Promise<PredictionEnsemble> {
    console.log('🔮 Gerando previsão ensemble...');

    const predictions: Array<{
      model: ModelType;
      direction: 'UP' | 'DOWN' | 'NEUTRAL';
      confidence: number;
      predictedPrice?: number;
    }> = [];

    // Coletar previsões de todos os modelos
    for (const [modelType, _] of this.models) {
      try {
        const prediction = await this.predictWithModel(modelType, multiTimeframeData, primaryTimeframe);
        predictions.push({
          model: modelType,
          ...prediction,
        });
      } catch (error) {
        console.warn(`⚠️ Erro ao prever com ${modelType}:`, error);
      }
    }

    if (predictions.length === 0) {
      throw new Error('Nenhum modelo conseguiu fazer previsão');
    }

    // Votação ponderada por confiança
    let upVotes = 0;
    let downVotes = 0;
    let neutralVotes = 0;

    predictions.forEach(pred => {
      if (pred.direction === 'UP') upVotes += pred.confidence;
      else if (pred.direction === 'DOWN') downVotes += pred.confidence;
      else neutralVotes += pred.confidence;
    });

    // Determinar direção final
    let finalDirection: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
    const maxVotes = Math.max(upVotes, downVotes, neutralVotes);
    
    if (maxVotes === upVotes) finalDirection = 'UP';
    else if (maxVotes === downVotes) finalDirection = 'DOWN';

    // Calcular confiança média
    const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;

    console.log(`✅ Ensemble: ${finalDirection} (confiança: ${(avgConfidence * 100).toFixed(2)}%)`);

    return {
      direction: finalDirection,
      confidence: avgConfidence,
      predictions,
      timestamp: Date.now(),
    };
  }

  /**
   * Salva todos os modelos
   */
  async saveModels(basePath: string): Promise<void> {
    console.log('💾 Salvando modelos...');

    for (const [modelType, model] of this.models) {
      const modelPath = `${basePath}/${modelType.toLowerCase()}`;
      await model.saveModel(modelPath);
    }

    console.log('✅ Todos os modelos salvos');
  }

  /**
   * Carrega todos os modelos
   */
  async loadModels(basePath: string, modelTypes: ModelType[]): Promise<void> {
    console.log('📂 Carregando modelos...');

    this.initializeModels(modelTypes);

    for (const modelType of modelTypes) {
      const model = this.models.get(modelType);
      if (model) {
        const modelPath = `${basePath}/${modelType.toLowerCase()}`;
        await model.loadModel(modelPath);
      }
    }

    console.log('✅ Todos os modelos carregados');
  }

  /**
   * Retorna informações sobre todos os modelos
   */
  getModelsInfo(): Map<ModelType, object> {
    const info = new Map<ModelType, object>();

    for (const [modelType, model] of this.models) {
      info.set(modelType, model.getModelInfo());
    }

    return info;
  }

  /**
   * Avalia performance de um modelo
   */
  async evaluateModel(
    modelType: ModelType,
    multiTimeframeData: MultiTimeframeData,
    primaryTimeframe: keyof MultiTimeframeData = '1m'
  ): Promise<{
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    mae: number;
    rmse: number;
  }> {
    console.log(`📊 Avaliando modelo ${modelType}...`);

    const { X, y } = this.prepareTrainingData(multiTimeframeData, primaryTimeframe);
    const split = this.dataPreparation.splitDataset(X, y, 0.7, 0.15, 0.15);

    // Fazer previsões no conjunto de teste
    const predictions: number[] = [];
    const actuals: number[] = split.test.y;

    // Simplificado: usar apenas últimas amostras
    for (let i = 0; i < Math.min(100, split.test.X.length); i++) {
      try {
        const pred = await this.predictWithModel(modelType, multiTimeframeData, primaryTimeframe);
        predictions.push(pred.predictedPrice || 0);
      } catch (error) {
        predictions.push(0);
      }
    }

    // Calcular métricas de regressão
    const regressionMetrics = this.dataPreparation.calculateRegressionMetrics(
      actuals.slice(0, predictions.length),
      predictions
    );

    // Converter para classificação para métricas adicionais
    const classActuals = actuals.slice(0, predictions.length).map((val, i) => {
      const change = ((val - actuals[i > 0 ? i - 1 : 0]) / actuals[i > 0 ? i - 1 : 0]) * 100;
      return change > 0.5 ? 1 : change < -0.5 ? -1 : 0;
    });

    const classPreds = predictions.map((val, i) => {
      const change = ((val - actuals[i > 0 ? i - 1 : 0]) / actuals[i > 0 ? i - 1 : 0]) * 100;
      return change > 0.5 ? 1 : change < -0.5 ? -1 : 0;
    });

    const classMetrics = this.dataPreparation.calculateMetrics(classActuals, classPreds);

    console.log(`✅ Avaliação concluída - Accuracy: ${(classMetrics.accuracy * 100).toFixed(2)}%`);

    return {
      accuracy: classMetrics.accuracy,
      precision: classMetrics.precision,
      recall: classMetrics.recall,
      f1Score: classMetrics.f1Score,
      mae: regressionMetrics.mae,
      rmse: regressionMetrics.rmse,
    };
  }
}
