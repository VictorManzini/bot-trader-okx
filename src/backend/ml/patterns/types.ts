/**
 * Tipos e Interfaces para Detecção de Padrões
 */

export interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type CandlePatternType =
  | 'DOJI'
  | 'MARUBOZU_BULLISH'
  | 'MARUBOZU_BEARISH'
  | 'HAMMER'
  | 'INVERTED_HAMMER'
  | 'HANGING_MAN'
  | 'SHOOTING_STAR'
  | 'ENGULFING_BULLISH'
  | 'ENGULFING_BEARISH'
  | 'MORNING_STAR'
  | 'EVENING_STAR'
  | 'THREE_WHITE_SOLDIERS'
  | 'THREE_BLACK_CROWS'
  | 'PIERCING_LINE'
  | 'DARK_CLOUD_COVER'
  | 'HARAMI_BULLISH'
  | 'HARAMI_BEARISH'
  | 'TWEEZER_TOP'
  | 'TWEEZER_BOTTOM';

export type ChartPatternType =
  | 'HEAD_AND_SHOULDERS'
  | 'INVERSE_HEAD_AND_SHOULDERS'
  | 'DOUBLE_TOP'
  | 'DOUBLE_BOTTOM'
  | 'TRIPLE_TOP'
  | 'TRIPLE_BOTTOM'
  | 'TRIANGLE_ASCENDING'
  | 'TRIANGLE_DESCENDING'
  | 'TRIANGLE_SYMMETRICAL'
  | 'FLAG_BULLISH'
  | 'FLAG_BEARISH'
  | 'PENNANT_BULLISH'
  | 'PENNANT_BEARISH'
  | 'WEDGE_RISING'
  | 'WEDGE_FALLING'
  | 'CHANNEL_ASCENDING'
  | 'CHANNEL_DESCENDING'
  | 'CUP_AND_HANDLE'
  | 'ROUNDING_BOTTOM'
  | 'ROUNDING_TOP';

export type PatternDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type PatternReliability = 'HIGH' | 'MEDIUM' | 'LOW';

export interface CandlePatternResult {
  type: CandlePatternType;
  direction: PatternDirection;
  confidence: number;
  reliability: PatternReliability;
  description: string;
  timestamp: number;
  candleIndex: number;
}

export interface ChartPatternResult {
  type: ChartPatternType;
  direction: PatternDirection;
  confidence: number;
  reliability: PatternReliability;
  description: string;
  timestamp: number;
  startIndex: number;
  endIndex: number;
  keyLevels: {
    support?: number;
    resistance?: number;
    neckline?: number;
    target?: number;
  };
}

export interface PatternDetectionResult {
  candlePatterns: CandlePatternResult[];
  chartPatterns: ChartPatternResult[];
  cnnPatterns?: any[]; // Padrões detectados pela CNN
  overallSignal: {
    direction: PatternDirection;
    strength: number;
    confidence: number;
  };
  timestamp: number;
}

export interface PatternFeatures {
  // Padrões de candles detectados
  hasDoji: boolean;
  hasHammer: boolean;
  hasEngulfing: boolean;
  hasMorningStar: boolean;
  hasEveningStar: boolean;
  
  // Padrões gráficos detectados
  hasHeadAndShoulders: boolean;
  hasDoubleTop: boolean;
  hasDoubleBottom: boolean;
  hasTriangle: boolean;
  hasFlag: boolean;
  hasCupAndHandle: boolean;
  
  // Scores agregados
  bullishCandleScore: number;
  bearishCandleScore: number;
  bullishChartScore: number;
  bearishChartScore: number;
  
  // Sinal combinado
  combinedSignal: number; // -1 a 1
  patternStrength: number; // 0 a 1
}

export interface PatternDetectorConfig {
  enableCandlePatterns: boolean;
  enableChartPatterns: boolean;
  enableCNN: boolean;
  minConfidence: number;
  lookbackPeriod: number;
  cnnModelPath?: string;
}
