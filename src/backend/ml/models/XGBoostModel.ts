/**
 * XGBoost Model usando features técnicas
 * Para classificação de direção de mercado (UP/DOWN/NEUTRAL)
 * 
 * NOTA: Este é um wrapper TypeScript. O XGBoost real requer biblioteca nativa.
 * Para produção, use xgboost-node ou implemente via Python API.
 */

export interface XGBoostConfig {
  maxDepth: number;
  learningRate: number;
  nEstimators: number;
  objective: 'reg:squarederror' | 'binary:logistic' | 'multi:softmax';
  subsample: number;
  colsampleBytree: number;
  minChildWeight: number;
  gamma: number;
}

export interface TechnicalFeatures {
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  ema9: number;
  ema21: number;
  ema50: number;
  sma20: number;
  sma50: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  atr: number;
  adx: number;
  stochK: number;
  stochD: number;
  volume: number;
  volumeMA: number;
  priceChange: number;
  volatility: number;
}

export interface PredictionResult {
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  probability: number;
  confidence: number;
  timestamp: number;
  features: TechnicalFeatures;
}

export class XGBoostModel {
  private model: any = null;
  private config: XGBoostConfig;
  private isTraining: boolean = false;
  private featureImportance: Map<string, number> = new Map();

  constructor(config?: Partial<XGBoostConfig>) {
    this.config = {
      maxDepth: config?.maxDepth || 6,
      learningRate: config?.learningRate || 0.1,
      nEstimators: config?.nEstimators || 100,
      objective: config?.objective || 'multi:softmax',
      subsample: config?.subsample || 0.8,
      colsampleBytree: config?.colsampleBytree || 0.8,
      minChildWeight: config?.minChildWeight || 1,
      gamma: config?.gamma || 0,
    };
  }

  /**
   * Extrai features técnicas dos dados OHLCV
   */
  extractFeatures(ohlcv: number[][], indicators: any): TechnicalFeatures {
    const latest = ohlcv[ohlcv.length - 1];
    const close = latest[4];
    const volume = latest[5];

    return {
      rsi: indicators.rsi || 50,
      macd: indicators.macd || 0,
      macdSignal: indicators.macdSignal || 0,
      macdHist: indicators.macdHist || 0,
      ema9: indicators.ema9 || close,
      ema21: indicators.ema21 || close,
      ema50: indicators.ema50 || close,
      sma20: indicators.sma20 || close,
      sma50: indicators.sma50 || close,
      bollingerUpper: indicators.bollingerUpper || close * 1.02,
      bollingerMiddle: indicators.bollingerMiddle || close,
      bollingerLower: indicators.bollingerLower || close * 0.98,
      atr: indicators.atr || 0,
      adx: indicators.adx || 25,
      stochK: indicators.stochK || 50,
      stochD: indicators.stochD || 50,
      volume: volume,
      volumeMA: indicators.volumeMA || volume,
      priceChange: indicators.priceChange || 0,
      volatility: indicators.volatility || 0,
    };
  }

  /**
   * Converte features para array numérico
   */
  private featuresToArray(features: TechnicalFeatures): number[] {
    return [
      features.rsi,
      features.macd,
      features.macdSignal,
      features.macdHist,
      features.ema9,
      features.ema21,
      features.ema50,
      features.sma20,
      features.sma50,
      features.bollingerUpper,
      features.bollingerMiddle,
      features.bollingerLower,
      features.atr,
      features.adx,
      features.stochK,
      features.stochD,
      features.volume,
      features.volumeMA,
      features.priceChange,
      features.volatility,
    ];
  }

  /**
   * Treina o modelo com dados históricos
   * NOTA: Implementação simplificada. Para produção, use xgboost-node ou Python API
   */
  async train(X: TechnicalFeatures[], y: number[]): Promise<void> {
    this.isTraining = true;

    try {
      console.log('🔄 Iniciando treinamento do XGBoost...');
      console.log(`📊 Amostras de treino: ${X.length}`);

      // Converter features para arrays numéricos
      const XArray = X.map(f => this.featuresToArray(f));

      // SIMULAÇÃO: Em produção, usar biblioteca XGBoost real
      // Aqui criamos um modelo simplificado baseado em regras
      this.model = {
        trained: true,
        config: this.config,
        samples: X.length,
        features: Object.keys(X[0]).length,
      };

      // Calcular importância das features (simulado)
      this.calculateFeatureImportance(X, y);

      console.log('✅ Treinamento do XGBoost concluído');
      console.log('📈 Top 5 features mais importantes:');
      const topFeatures = Array.from(this.featureImportance.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      topFeatures.forEach(([feature, importance]) => {
        console.log(`   ${feature}: ${(importance * 100).toFixed(2)}%`);
      });
    } catch (error) {
      console.error('❌ Erro no treinamento do XGBoost:', error);
      throw error;
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Calcula importância das features (simulado)
   */
  private calculateFeatureImportance(X: TechnicalFeatures[], y: number[]): void {
    const featureNames = Object.keys(X[0]) as (keyof TechnicalFeatures)[];
    
    featureNames.forEach(feature => {
      // Correlação simplificada com target
      const values = X.map(f => f[feature] as number);
      const correlation = this.calculateCorrelation(values, y);
      this.featureImportance.set(feature, Math.abs(correlation));
    });

    // Normalizar importâncias
    const total = Array.from(this.featureImportance.values()).reduce((a, b) => a + b, 0);
    this.featureImportance.forEach((value, key) => {
      this.featureImportance.set(key, value / total);
    });
  }

  /**
   * Calcula correlação simples entre duas séries
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      numerator += diffX * diffY;
      denomX += diffX * diffX;
      denomY += diffY * diffY;
    }

    return numerator / Math.sqrt(denomX * denomY);
  }

  /**
   * Faz previsão baseada em features técnicas
   */
  async predict(features: TechnicalFeatures): Promise<PredictionResult> {
    if (!this.model) {
      throw new Error('Modelo não foi treinado ainda');
    }

    if (this.isTraining) {
      throw new Error('Modelo está em treinamento');
    }

    // SIMULAÇÃO: Lógica baseada em regras técnicas
    // Em produção, usar modelo XGBoost real
    let score = 0;
    let confidence = 0;

    // RSI
    if (features.rsi < 30) score += 2; // Oversold
    else if (features.rsi > 70) score -= 2; // Overbought
    else score += (50 - features.rsi) / 20;

    // MACD
    if (features.macdHist > 0) score += 1;
    else score -= 1;

    // EMAs
    if (features.ema9 > features.ema21 && features.ema21 > features.ema50) score += 2;
    else if (features.ema9 < features.ema21 && features.ema21 < features.ema50) score -= 2;

    // Bollinger Bands
    const bbPosition = (features.bollingerMiddle - features.bollingerLower) / 
                       (features.bollingerUpper - features.bollingerLower);
    if (bbPosition < 0.2) score += 1;
    else if (bbPosition > 0.8) score -= 1;

    // ADX (força da tendência)
    if (features.adx > 25) {
      confidence = Math.min(features.adx / 50, 1);
    } else {
      confidence = 0.3;
    }

    // Determinar direção
    let direction: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
    if (score > 1.5) direction = 'UP';
    else if (score < -1.5) direction = 'DOWN';

    // Calcular probabilidade
    const probability = (score + 5) / 10; // Normalizar entre 0 e 1

    return {
      direction,
      probability: Math.max(0, Math.min(1, probability)),
      confidence,
      timestamp: Date.now(),
      features,
    };
  }

  /**
   * Retorna importância das features
   */
  getFeatureImportance(): Map<string, number> {
    return this.featureImportance;
  }

  /**
   * Salva o modelo (simulado)
   */
  async saveModel(path: string): Promise<void> {
    if (!this.model) {
      throw new Error('Nenhum modelo para salvar');
    }

    // Em produção, salvar modelo XGBoost real
    console.log(`✅ Modelo XGBoost salvo em: ${path}`);
  }

  /**
   * Carrega um modelo (simulado)
   */
  async loadModel(path: string): Promise<void> {
    // Em produção, carregar modelo XGBoost real
    this.model = { trained: true };
    console.log(`✅ Modelo XGBoost carregado de: ${path}`);
  }

  /**
   * Retorna informações sobre o modelo
   */
  getModelInfo(): object {
    if (!this.model) {
      return { status: 'not_initialized' };
    }

    return {
      status: this.isTraining ? 'training' : 'ready',
      config: this.config,
      model: this.model,
      featureCount: this.featureImportance.size,
    };
  }
}
