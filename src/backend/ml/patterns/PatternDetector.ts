/**
 * Pattern Detector - Orquestrador de Detecção de Padrões
 * Combina regras programadas + CNN para detecção robusta
 */

import { CandlePatternDetector } from './CandlePatterns';
import { ChartPatternDetector } from './ChartPatterns';
import { CNNPatternModel } from '../models/CNNPatternModel';
import {
  OHLCVData,
  PatternDetectionResult,
  PatternDetectorConfig,
  PatternFeatures,
  PatternDirection,
} from './types';

export class PatternDetector {
  private candleDetector: CandlePatternDetector;
  private chartDetector: ChartPatternDetector;
  private cnnModel: CNNPatternModel | null = null;
  private config: PatternDetectorConfig;

  constructor(config?: Partial<PatternDetectorConfig>) {
    this.config = {
      enableCandlePatterns: config?.enableCandlePatterns ?? true,
      enableChartPatterns: config?.enableChartPatterns ?? true,
      enableCNN: config?.enableCNN ?? false,
      minConfidence: config?.minConfidence ?? 0.6,
      lookbackPeriod: config?.lookbackPeriod ?? 100,
      cnnModelPath: config?.cnnModelPath,
    };

    this.candleDetector = new CandlePatternDetector();
    this.chartDetector = new ChartPatternDetector();

    if (this.config.enableCNN) {
      this.cnnModel = new CNNPatternModel();
    }
  }

  /**
   * Detecta todos os padrões disponíveis
   */
  async detectAllPatterns(data: OHLCVData[]): Promise<PatternDetectionResult> {
    const candlePatterns = this.config.enableCandlePatterns
      ? this.candleDetector.detectPatterns(data, 3)
      : [];

    const chartPatterns = this.config.enableChartPatterns
      ? this.chartDetector.detectPatterns(data, this.config.lookbackPeriod)
      : [];

    let cnnPatterns: any[] = [];
    if (this.config.enableCNN && this.cnnModel) {
      try {
        const ohlcvArray = data.map(d => [d.timestamp, d.open, d.high, d.low, d.close, d.volume]);
        const cnnResult = await this.cnnModel.detectPatterns(ohlcvArray);
        cnnPatterns = cnnResult.patterns;
      } catch (error) {
        console.warn('⚠️ Erro na detecção CNN:', error);
      }
    }

    // Filtrar por confiança mínima
    const filteredCandlePatterns = candlePatterns.filter(p => p.confidence >= this.config.minConfidence);
    const filteredChartPatterns = chartPatterns.filter(p => p.confidence >= this.config.minConfidence);

    // Calcular sinal geral
    const overallSignal = this.calculateOverallSignal(
      filteredCandlePatterns,
      filteredChartPatterns,
      cnnPatterns
    );

    return {
      candlePatterns: filteredCandlePatterns,
      chartPatterns: filteredChartPatterns,
      cnnPatterns,
      overallSignal,
      timestamp: Date.now(),
    };
  }

  /**
   * Extrai features de padrões para usar em modelos de ML
   */
  extractPatternFeatures(data: OHLCVData[]): PatternFeatures {
    const candlePatterns = this.candleDetector.detectPatterns(data, 3);
    const chartPatterns = this.chartDetector.detectPatterns(data, this.config.lookbackPeriod);

    // Verificar presença de padrões específicos
    const hasDoji = candlePatterns.some(p => p.type === 'DOJI');
    const hasHammer = candlePatterns.some(p => p.type === 'HAMMER');
    const hasEngulfing = candlePatterns.some(p => p.type.includes('ENGULFING'));
    const hasMorningStar = candlePatterns.some(p => p.type === 'MORNING_STAR');
    const hasEveningStar = candlePatterns.some(p => p.type === 'EVENING_STAR');

    const hasHeadAndShoulders = chartPatterns.some(p => p.type.includes('HEAD_AND_SHOULDERS'));
    const hasDoubleTop = chartPatterns.some(p => p.type === 'DOUBLE_TOP');
    const hasDoubleBottom = chartPatterns.some(p => p.type === 'DOUBLE_BOTTOM');
    const hasTriangle = chartPatterns.some(p => p.type.includes('TRIANGLE'));
    const hasFlag = chartPatterns.some(p => p.type.includes('FLAG'));
    const hasCupAndHandle = chartPatterns.some(p => p.type === 'CUP_AND_HANDLE');

    // Calcular scores agregados
    const bullishCandleScore = this.calculateBullishScore(candlePatterns);
    const bearishCandleScore = this.calculateBearishScore(candlePatterns);
    const bullishChartScore = this.calculateBullishScore(chartPatterns);
    const bearishChartScore = this.calculateBearishScore(chartPatterns);

    // Sinal combinado (-1 a 1)
    const totalBullish = bullishCandleScore + bullishChartScore;
    const totalBearish = bearishCandleScore + bearishChartScore;
    const combinedSignal = totalBullish + totalBearish === 0
      ? 0
      : (totalBullish - totalBearish) / (totalBullish + totalBearish);

    // Força do padrão (0 a 1)
    const patternStrength = Math.min((totalBullish + totalBearish) / 4, 1);

    return {
      hasDoji,
      hasHammer,
      hasEngulfing,
      hasMorningStar,
      hasEveningStar,
      hasHeadAndShoulders,
      hasDoubleTop,
      hasDoubleBottom,
      hasTriangle,
      hasFlag,
      hasCupAndHandle,
      bullishCandleScore,
      bearishCandleScore,
      bullishChartScore,
      bearishChartScore,
      combinedSignal,
      patternStrength,
    };
  }

  /**
   * Converte features de padrões para array numérico
   */
  patternFeaturesToArray(features: PatternFeatures): number[] {
    return [
      features.hasDoji ? 1 : 0,
      features.hasHammer ? 1 : 0,
      features.hasEngulfing ? 1 : 0,
      features.hasMorningStar ? 1 : 0,
      features.hasEveningStar ? 1 : 0,
      features.hasHeadAndShoulders ? 1 : 0,
      features.hasDoubleTop ? 1 : 0,
      features.hasDoubleBottom ? 1 : 0,
      features.hasTriangle ? 1 : 0,
      features.hasFlag ? 1 : 0,
      features.hasCupAndHandle ? 1 : 0,
      features.bullishCandleScore,
      features.bearishCandleScore,
      features.bullishChartScore,
      features.bearishChartScore,
      features.combinedSignal,
      features.patternStrength,
    ];
  }

  /**
   * Calcula sinal geral baseado em todos os padrões
   */
  private calculateOverallSignal(
    candlePatterns: any[],
    chartPatterns: any[],
    cnnPatterns: any[]
  ): { direction: PatternDirection; strength: number; confidence: number } {
    let bullishScore = 0;
    let bearishScore = 0;
    let totalConfidence = 0;
    let patternCount = 0;

    // Processar padrões de candles
    candlePatterns.forEach(pattern => {
      if (pattern.direction === 'BULLISH') {
        bullishScore += pattern.confidence;
      } else if (pattern.direction === 'BEARISH') {
        bearishScore += pattern.confidence;
      }
      totalConfidence += pattern.confidence;
      patternCount++;
    });

    // Processar padrões gráficos (peso maior)
    chartPatterns.forEach(pattern => {
      const weight = 1.5; // Padrões gráficos têm mais peso
      if (pattern.direction === 'BULLISH') {
        bullishScore += pattern.confidence * weight;
      } else if (pattern.direction === 'BEARISH') {
        bearishScore += pattern.confidence * weight;
      }
      totalConfidence += pattern.confidence * weight;
      patternCount++;
    });

    // Processar padrões CNN
    cnnPatterns.forEach(pattern => {
      const weight = 1.2;
      if (pattern.direction === 'BULLISH') {
        bullishScore += pattern.confidence * weight;
      } else if (pattern.direction === 'BEARISH') {
        bearishScore += pattern.confidence * weight;
      }
      totalConfidence += pattern.confidence * weight;
      patternCount++;
    });

    // Determinar direção
    let direction: PatternDirection = 'NEUTRAL';
    if (bullishScore > bearishScore * 1.2) {
      direction = 'BULLISH';
    } else if (bearishScore > bullishScore * 1.2) {
      direction = 'BEARISH';
    }

    // Calcular força (0 a 1)
    const strength = patternCount > 0
      ? Math.min(Math.abs(bullishScore - bearishScore) / patternCount, 1)
      : 0;

    // Calcular confiança média
    const confidence = patternCount > 0 ? totalConfidence / patternCount : 0;

    return { direction, strength, confidence };
  }

  /**
   * Calcula score bullish de padrões
   */
  private calculateBullishScore(patterns: any[]): number {
    return patterns
      .filter(p => p.direction === 'BULLISH')
      .reduce((sum, p) => sum + p.confidence, 0);
  }

  /**
   * Calcula score bearish de padrões
   */
  private calculateBearishScore(patterns: any[]): number {
    return patterns
      .filter(p => p.direction === 'BEARISH')
      .reduce((sum, p) => sum + p.confidence, 0);
  }

  /**
   * Inicializa modelo CNN (se habilitado)
   */
  async initializeCNN(): Promise<void> {
    if (!this.config.enableCNN || !this.cnnModel) {
      return;
    }

    if (this.config.cnnModelPath) {
      try {
        await this.cnnModel.loadModel(this.config.cnnModelPath);
        console.log('✅ Modelo CNN carregado com sucesso');
      } catch (error) {
        console.warn('⚠️ Não foi possível carregar modelo CNN, construindo novo:', error);
        this.cnnModel.buildModel();
      }
    } else {
      this.cnnModel.buildModel();
      console.log('✅ Modelo CNN construído (não treinado)');
    }
  }

  /**
   * Treina modelo CNN com dados históricos
   */
  async trainCNN(trainingData: { images: any; labels: any }): Promise<void> {
    if (!this.config.enableCNN || !this.cnnModel) {
      throw new Error('CNN não está habilitada');
    }

    await this.cnnModel.train(trainingData.images, trainingData.labels);
  }

  /**
   * Salva modelo CNN
   */
  async saveCNN(path: string): Promise<void> {
    if (!this.config.enableCNN || !this.cnnModel) {
      throw new Error('CNN não está habilitada');
    }

    await this.cnnModel.saveModel(path);
  }

  /**
   * Retorna informações sobre o detector
   */
  getInfo(): object {
    return {
      config: this.config,
      cnnStatus: this.cnnModel ? this.cnnModel.getModelInfo() : 'disabled',
    };
  }

  /**
   * Libera recursos
   */
  dispose(): void {
    if (this.cnnModel) {
      this.cnnModel.dispose();
    }
  }
}
