/**
 * Performance Tracker
 * Rastreia e analisa performance dos modelos em tempo real
 */

import { ModelType } from '../features/MLPipeline';
import { PerformanceMetrics, PredictionResult } from './types';

export class PerformanceTracker {
  private results: PredictionResult[];
  private resultsByModel: Map<ModelType, PredictionResult[]>;
  private maxHistorySize: number;

  constructor(maxHistorySize: number = 10000) {
    this.results = [];
    this.resultsByModel = new Map();
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Adiciona um novo resultado de previsão
   */
  addResult(result: PredictionResult, modelType?: ModelType): void {
    this.results.push(result);

    // Adicionar ao histórico do modelo específico
    if (modelType) {
      if (!this.resultsByModel.has(modelType)) {
        this.resultsByModel.set(modelType, []);
      }
      this.resultsByModel.get(modelType)!.push(result);
    }

    // Limitar tamanho do histórico
    if (this.results.length > this.maxHistorySize) {
      this.results = this.results.slice(-this.maxHistorySize);
    }

    if (modelType) {
      const modelResults = this.resultsByModel.get(modelType)!;
      if (modelResults.length > this.maxHistorySize) {
        this.resultsByModel.set(modelType, modelResults.slice(-this.maxHistorySize));
      }
    }
  }

  /**
   * Calcula métricas de performance geral
   */
  getOverallPerformance(): PerformanceMetrics {
    return this.calculateMetrics(this.results);
  }

  /**
   * Calcula métricas de performance por modelo
   */
  getPerformanceByModel(): Map<ModelType, PerformanceMetrics> {
    const performanceMap = new Map<ModelType, PerformanceMetrics>();

    for (const [modelType, results] of this.resultsByModel) {
      performanceMap.set(modelType, this.calculateMetrics(results));
    }

    return performanceMap;
  }

  /**
   * Calcula métricas de performance para um conjunto de resultados
   */
  private calculateMetrics(results: PredictionResult[]): PerformanceMetrics {
    if (results.length === 0) {
      return this.getEmptyMetrics();
    }

    const totalPredictions = results.length;
    const correctPredictions = results.filter(r => r.isCorrect).length;
    const accuracy = correctPredictions / totalPredictions;

    // Calcular precision, recall, f1 para cada classe
    const upPredictions = results.filter(r => r.prediction === 'UP');
    const downPredictions = results.filter(r => r.prediction === 'DOWN');
    const upActual = results.filter(r => r.actual === 'UP');
    const downActual = results.filter(r => r.actual === 'DOWN');

    const truePositivesUp = results.filter(r => r.prediction === 'UP' && r.actual === 'UP').length;
    const truePositivesDown = results.filter(r => r.prediction === 'DOWN' && r.actual === 'DOWN').length;

    const precisionUp = upPredictions.length > 0 ? truePositivesUp / upPredictions.length : 0;
    const precisionDown = downPredictions.length > 0 ? truePositivesDown / downPredictions.length : 0;
    const precision = (precisionUp + precisionDown) / 2;

    const recallUp = upActual.length > 0 ? truePositivesUp / upActual.length : 0;
    const recallDown = downActual.length > 0 ? truePositivesDown / downActual.length : 0;
    const recall = (recallUp + recallDown) / 2;

    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    // Calcular métricas de PnL
    const totalPnl = results.reduce((sum, r) => sum + r.pnl, 0);
    const avgPnl = totalPnl / totalPredictions;

    const totalPnlPercentage = results.reduce((sum, r) => sum + r.pnlPercentage, 0);
    const avgPnlPercentage = totalPnlPercentage / totalPredictions;

    const winningTrades = results.filter(r => r.pnl > 0).length;
    const winRate = winningTrades / totalPredictions;

    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / totalPredictions;

    // Calcular Sharpe Ratio
    const returns = results.map(r => r.pnlPercentage);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

    return {
      accuracy,
      precision,
      recall,
      f1Score,
      totalPredictions,
      correctPredictions,
      avgPnl,
      avgPnlPercentage,
      winRate,
      avgConfidence,
      sharpeRatio,
    };
  }

  /**
   * Retorna métricas vazias
   */
  private getEmptyMetrics(): PerformanceMetrics {
    return {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      totalPredictions: 0,
      correctPredictions: 0,
      avgPnl: 0,
      avgPnlPercentage: 0,
      winRate: 0,
      avgConfidence: 0,
      sharpeRatio: 0,
    };
  }

  /**
   * Retorna performance em janela de tempo específica
   */
  getPerformanceInWindow(windowMinutes: number): PerformanceMetrics {
    const windowMs = windowMinutes * 60 * 1000;
    const cutoffTime = Date.now() - windowMs;
    
    const recentResults = this.results.filter(r => r.timestamp >= cutoffTime);
    return this.calculateMetrics(recentResults);
  }

  /**
   * Retorna performance por modelo em janela de tempo
   */
  getPerformanceByModelInWindow(windowMinutes: number): Map<ModelType, PerformanceMetrics> {
    const windowMs = windowMinutes * 60 * 1000;
    const cutoffTime = Date.now() - windowMs;
    
    const performanceMap = new Map<ModelType, PerformanceMetrics>();

    for (const [modelType, results] of this.resultsByModel) {
      const recentResults = results.filter(r => r.timestamp >= cutoffTime);
      performanceMap.set(modelType, this.calculateMetrics(recentResults));
    }

    return performanceMap;
  }

  /**
   * Retorna tendência de performance (últimas N previsões)
   */
  getPerformanceTrend(windowSize: number = 50): {
    current: number;
    previous: number;
    trend: 'improving' | 'declining' | 'stable';
    change: number;
  } {
    if (this.results.length < windowSize * 2) {
      return {
        current: 0,
        previous: 0,
        trend: 'stable',
        change: 0,
      };
    }

    const recentResults = this.results.slice(-windowSize);
    const previousResults = this.results.slice(-windowSize * 2, -windowSize);

    const currentAccuracy = this.calculateMetrics(recentResults).accuracy;
    const previousAccuracy = this.calculateMetrics(previousResults).accuracy;

    const change = currentAccuracy - previousAccuracy;
    let trend: 'improving' | 'declining' | 'stable' = 'stable';

    if (change > 0.02) trend = 'improving';
    else if (change < -0.02) trend = 'declining';

    return {
      current: currentAccuracy,
      previous: previousAccuracy,
      trend,
      change,
    };
  }

  /**
   * Retorna estatísticas de confiança vs acurácia
   */
  getConfidenceAnalysis(): {
    highConfidence: { threshold: number; accuracy: number; count: number };
    mediumConfidence: { threshold: number; accuracy: number; count: number };
    lowConfidence: { threshold: number; accuracy: number; count: number };
  } {
    const highConf = this.results.filter(r => r.confidence >= 0.7);
    const medConf = this.results.filter(r => r.confidence >= 0.4 && r.confidence < 0.7);
    const lowConf = this.results.filter(r => r.confidence < 0.4);

    return {
      highConfidence: {
        threshold: 0.7,
        accuracy: this.calculateMetrics(highConf).accuracy,
        count: highConf.length,
      },
      mediumConfidence: {
        threshold: 0.4,
        accuracy: this.calculateMetrics(medConf).accuracy,
        count: medConf.length,
      },
      lowConfidence: {
        threshold: 0.0,
        accuracy: this.calculateMetrics(lowConf).accuracy,
        count: lowConf.length,
      },
    };
  }

  /**
   * Retorna melhores e piores períodos
   */
  getBestAndWorstPeriods(periodSize: number = 50): {
    best: { startIndex: number; endIndex: number; accuracy: number };
    worst: { startIndex: number; endIndex: number; accuracy: number };
  } {
    if (this.results.length < periodSize) {
      return {
        best: { startIndex: 0, endIndex: 0, accuracy: 0 },
        worst: { startIndex: 0, endIndex: 0, accuracy: 0 },
      };
    }

    let bestAccuracy = 0;
    let worstAccuracy = 1;
    let bestStart = 0;
    let worstStart = 0;

    for (let i = 0; i <= this.results.length - periodSize; i++) {
      const period = this.results.slice(i, i + periodSize);
      const accuracy = this.calculateMetrics(period).accuracy;

      if (accuracy > bestAccuracy) {
        bestAccuracy = accuracy;
        bestStart = i;
      }

      if (accuracy < worstAccuracy) {
        worstAccuracy = accuracy;
        worstStart = i;
      }
    }

    return {
      best: {
        startIndex: bestStart,
        endIndex: bestStart + periodSize,
        accuracy: bestAccuracy,
      },
      worst: {
        startIndex: worstStart,
        endIndex: worstStart + periodSize,
        accuracy: worstAccuracy,
      },
    };
  }

  /**
   * Exporta resultados para análise
   */
  exportResults(): PredictionResult[] {
    return [...this.results];
  }

  /**
   * Reseta todos os dados
   */
  reset(): void {
    this.results = [];
    this.resultsByModel.clear();
    console.log('🗑️ Performance Tracker resetado');
  }

  /**
   * Retorna número total de resultados
   */
  getTotalResults(): number {
    return this.results.length;
  }
}
