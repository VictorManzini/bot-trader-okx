/**
 * Prediction Logger
 * Registra e gerencia histórico de previsões
 */

import { PredictionRecord } from './types';

export class PredictionLogger {
  private predictions: Map<string, PredictionRecord>;
  private maxHistory: number;

  constructor(maxHistory: number = 10000) {
    this.predictions = new Map();
    this.maxHistory = maxHistory;
  }

  /**
   * Adiciona uma nova previsão
   */
  addPrediction(record: PredictionRecord): void {
    this.predictions.set(record.id, record);
    
    // Limpar histórico se exceder o máximo
    if (this.predictions.size > this.maxHistory) {
      this.cleanOldPredictions(this.maxHistory);
    }
  }

  /**
   * Atualiza uma previsão existente
   */
  updatePrediction(record: PredictionRecord): void {
    if (this.predictions.has(record.id)) {
      this.predictions.set(record.id, record);
    }
  }

  /**
   * Busca uma previsão por ID
   */
  getPrediction(id: string): PredictionRecord | undefined {
    return this.predictions.get(id);
  }

  /**
   * Retorna todas as previsões
   */
  getAllPredictions(): PredictionRecord[] {
    return Array.from(this.predictions.values());
  }

  /**
   * Retorna previsões avaliadas (com resultado real)
   */
  getEvaluatedPredictions(): PredictionRecord[] {
    return Array.from(this.predictions.values()).filter(
      p => p.actualPrice !== null && p.isCorrect !== null
    );
  }

  /**
   * Retorna previsões pendentes (sem resultado real)
   */
  getPendingPredictions(): PredictionRecord[] {
    return Array.from(this.predictions.values()).filter(
      p => p.actualPrice === null
    );
  }

  /**
   * Retorna N previsões mais recentes
   */
  getRecentPredictions(limit: number): PredictionRecord[] {
    const sorted = Array.from(this.predictions.values())
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return sorted.slice(0, limit);
  }

  /**
   * Retorna previsões em um intervalo de tempo
   */
  getPredictionsByTimeRange(startTime: number, endTime: number): PredictionRecord[] {
    return Array.from(this.predictions.values()).filter(
      p => p.timestamp >= startTime && p.timestamp <= endTime
    );
  }

  /**
   * Retorna previsões por símbolo
   */
  getPredictionsBySymbol(symbol: string): PredictionRecord[] {
    return Array.from(this.predictions.values()).filter(
      p => p.symbol === symbol
    );
  }

  /**
   * Retorna previsões por timeframe
   */
  getPredictionsByTimeframe(timeframe: string): PredictionRecord[] {
    return Array.from(this.predictions.values()).filter(
      p => p.timeframe === timeframe
    );
  }

  /**
   * Limpa previsões antigas mantendo apenas as N mais recentes
   */
  cleanOldPredictions(keepCount: number): void {
    const sorted = Array.from(this.predictions.values())
      .sort((a, b) => b.timestamp - a.timestamp);
    
    const toKeep = sorted.slice(0, keepCount);
    const toRemove = sorted.slice(keepCount);

    this.predictions.clear();
    toKeep.forEach(p => this.predictions.set(p.id, p));

    if (toRemove.length > 0) {
      console.log(`🧹 ${toRemove.length} previsões antigas removidas`);
    }
  }

  /**
   * Retorna estatísticas do histórico
   */
  getStats(): {
    total: number;
    evaluated: number;
    pending: number;
    correct: number;
    incorrect: number;
    accuracy: number;
    avgConfidence: number;
  } {
    const all = this.getAllPredictions();
    const evaluated = this.getEvaluatedPredictions();
    const correct = evaluated.filter(p => p.isCorrect === true).length;
    const incorrect = evaluated.filter(p => p.isCorrect === false).length;
    const accuracy = evaluated.length > 0 ? correct / evaluated.length : 0;
    const avgConfidence = all.length > 0
      ? all.reduce((sum, p) => sum + p.confidence, 0) / all.length
      : 0;

    return {
      total: all.length,
      evaluated: evaluated.length,
      pending: this.getPendingPredictions().length,
      correct,
      incorrect,
      accuracy,
      avgConfidence,
    };
  }

  /**
   * Exporta previsões para JSON
   */
  exportToJSON(): string {
    return JSON.stringify(Array.from(this.predictions.values()), null, 2);
  }

  /**
   * Importa previsões de JSON
   */
  importFromJSON(json: string): void {
    try {
      const data = JSON.parse(json) as PredictionRecord[];
      data.forEach(record => {
        this.predictions.set(record.id, record);
      });
      console.log(`✅ ${data.length} previsões importadas`);
    } catch (error) {
      console.error('❌ Erro ao importar previsões:', error);
      throw error;
    }
  }

  /**
   * Limpa todo o histórico
   */
  clear(): void {
    this.predictions.clear();
    console.log('🗑️ Histórico de previsões limpo');
  }

  /**
   * Retorna número total de previsões
   */
  getTotalPredictions(): number {
    return this.predictions.size;
  }
}
