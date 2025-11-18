/**
 * Types para Online Learning
 */

import { ModelType } from '../features/MLPipeline';

export interface PredictionRecord {
  id: string;
  timestamp: number;
  symbol: string;
  timeframe: string;
  currentPrice: number;
  prediction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
  modelPredictions: Array<{
    model: ModelType;
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    confidence: number;
    predictedPrice?: number;
  }>;
  actualPrice: number | null;
  actualDirection: 'UP' | 'DOWN' | 'NEUTRAL' | null;
  isCorrect: boolean | null;
  pnl: number | null;
  pnlPercentage: number | null;
  evaluatedAt: number | null;
}

export interface TrainingWindow {
  startTimestamp: number;
  endTimestamp: number;
  samples: number;
  predictions: PredictionRecord[];
}

export interface OnlineLearningConfig {
  updateFrequency: 'candle' | 'window' | 'manual';
  windowSize: number;
  minSamplesForUpdate: number;
  updateInterval: number;
  enableAutoRetrain: boolean;
  performanceThreshold: number;
  maxPredictionHistory: number;
  modelTypes: ModelType[];
}

export interface PerformanceMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  totalPredictions: number;
  correctPredictions: number;
  avgPnl: number;
  avgPnlPercentage: number;
  winRate: number;
  avgConfidence: number;
  sharpeRatio: number;
}

export interface PredictionResult {
  timestamp: number;
  isCorrect: boolean;
  pnl: number;
  pnlPercentage: number;
  confidence: number;
  prediction: 'UP' | 'DOWN' | 'NEUTRAL';
  actual: 'UP' | 'DOWN' | 'NEUTRAL';
}
