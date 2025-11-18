/**
 * Model Updater
 * Responsável por retreinar modelos com dados recentes
 */

import { MLPipeline, ModelType } from '../features/MLPipeline';
import { MultiTimeframeData, OHLCVData } from '../features/FeatureEngineering';
import { PredictionRecord, OnlineLearningConfig } from './types';

export class ModelUpdater {
  private mlPipeline: MLPipeline;
  private config: OnlineLearningConfig;
  private updateHistory: Array<{
    timestamp: number;
    modelType: ModelType;
    samplesUsed: number;
    success: boolean;
  }>;

  constructor(mlPipeline: MLPipeline, config: OnlineLearningConfig) {
    this.mlPipeline = mlPipeline;
    this.config = config;
    this.updateHistory = [];
  }

  /**
   * Atualiza (retreina) um modelo específico
   */
  async updateModel(
    modelType: ModelType,
    multiTimeframeData: MultiTimeframeData,
    recentPredictions: PredictionRecord[]
  ): Promise<void> {
    console.log(`🔄 Iniciando atualização do modelo ${modelType}...`);
    
    const startTime = Date.now();

    try {
      // Filtrar apenas previsões avaliadas
      const evaluatedPredictions = recentPredictions.filter(
        p => p.actualPrice !== null && p.isCorrect !== null
      );

      if (evaluatedPredictions.length < this.config.minSamplesForUpdate) {
        console.warn(`⚠️ Amostras insuficientes para ${modelType}: ${evaluatedPredictions.length}/${this.config.minSamplesForUpdate}`);
        return;
      }

      console.log(`📊 Usando ${evaluatedPredictions.length} amostras para retreinamento`);

      // Preparar dados de treinamento incremental
      const trainingData = this.prepareIncrementalTrainingData(
        multiTimeframeData,
        evaluatedPredictions
      );

      // Retreinar modelo
      await this.mlPipeline.trainModel(modelType, trainingData);

      const duration = Date.now() - startTime;
      console.log(`✅ Modelo ${modelType} atualizado em ${(duration / 1000).toFixed(2)}s`);

      // Registrar atualização
      this.updateHistory.push({
        timestamp: Date.now(),
        modelType,
        samplesUsed: evaluatedPredictions.length,
        success: true,
      });

      // Limitar histórico de atualizações
      if (this.updateHistory.length > 100) {
        this.updateHistory = this.updateHistory.slice(-100);
      }

    } catch (error) {
      console.error(`❌ Erro ao atualizar modelo ${modelType}:`, error);
      
      this.updateHistory.push({
        timestamp: Date.now(),
        modelType,
        samplesUsed: 0,
        success: false,
      });

      throw error;
    }
  }

  /**
   * Prepara dados para treinamento incremental
   */
  private prepareIncrementalTrainingData(
    multiTimeframeData: MultiTimeframeData,
    predictions: PredictionRecord[]
  ): MultiTimeframeData {
    // Usar apenas os dados mais recentes baseados nas previsões
    const windowSize = this.config.windowSize;
    
    // Para cada timeframe, pegar apenas os últimos N candles
    const incrementalData: MultiTimeframeData = {};

    for (const [timeframe, data] of Object.entries(multiTimeframeData)) {
      if (data && data.length > 0) {
        incrementalData[timeframe as keyof MultiTimeframeData] = data.slice(-windowSize);
      }
    }

    return incrementalData;
  }

  /**
   * Atualiza múltiplos modelos em paralelo
   */
  async updateMultipleModels(
    modelTypes: ModelType[],
    multiTimeframeData: MultiTimeframeData,
    recentPredictions: PredictionRecord[]
  ): Promise<void> {
    console.log(`🔄 Atualizando ${modelTypes.length} modelos em paralelo...`);

    const updatePromises = modelTypes.map(modelType =>
      this.updateModel(modelType, multiTimeframeData, recentPredictions)
        .catch(error => {
          console.error(`❌ Falha ao atualizar ${modelType}:`, error);
        })
    );

    await Promise.all(updatePromises);
    console.log('✅ Atualização em lote concluída');
  }

  /**
   * Verifica se um modelo precisa de atualização
   */
  shouldUpdateModel(
    modelType: ModelType,
    currentPerformance: number
  ): boolean {
    // Verificar se performance está abaixo do threshold
    if (currentPerformance < this.config.performanceThreshold) {
      console.log(`⚠️ ${modelType} abaixo do threshold: ${(currentPerformance * 100).toFixed(2)}%`);
      return true;
    }

    // Verificar última atualização
    const lastUpdate = this.getLastUpdate(modelType);
    if (!lastUpdate) {
      return true;
    }

    const timeSinceUpdate = Date.now() - lastUpdate.timestamp;
    if (timeSinceUpdate > this.config.updateInterval) {
      console.log(`⏰ ${modelType} precisa atualização: ${(timeSinceUpdate / 3600000).toFixed(2)}h desde última atualização`);
      return true;
    }

    return false;
  }

  /**
   * Retorna última atualização de um modelo
   */
  private getLastUpdate(modelType: ModelType): {
    timestamp: number;
    samplesUsed: number;
    success: boolean;
  } | null {
    const updates = this.updateHistory
      .filter(u => u.modelType === modelType && u.success)
      .sort((a, b) => b.timestamp - a.timestamp);

    return updates.length > 0 ? updates[0] : null;
  }

  /**
   * Retorna histórico de atualizações
   */
  getUpdateHistory(modelType?: ModelType): Array<{
    timestamp: number;
    modelType: ModelType;
    samplesUsed: number;
    success: boolean;
  }> {
    if (modelType) {
      return this.updateHistory.filter(u => u.modelType === modelType);
    }
    return [...this.updateHistory];
  }

  /**
   * Retorna estatísticas de atualizações
   */
  getUpdateStats(): {
    totalUpdates: number;
    successfulUpdates: number;
    failedUpdates: number;
    avgSamplesUsed: number;
    lastUpdateTime: number | null;
    updatesByModel: Map<ModelType, number>;
  } {
    const total = this.updateHistory.length;
    const successful = this.updateHistory.filter(u => u.success).length;
    const failed = total - successful;
    const avgSamples = total > 0
      ? this.updateHistory.reduce((sum, u) => sum + u.samplesUsed, 0) / total
      : 0;
    const lastUpdate = this.updateHistory.length > 0
      ? this.updateHistory[this.updateHistory.length - 1].timestamp
      : null;

    const updatesByModel = new Map<ModelType, number>();
    this.updateHistory.forEach(u => {
      updatesByModel.set(u.modelType, (updatesByModel.get(u.modelType) || 0) + 1);
    });

    return {
      totalUpdates: total,
      successfulUpdates: successful,
      failedUpdates: failed,
      avgSamplesUsed: avgSamples,
      lastUpdateTime: lastUpdate,
      updatesByModel,
    };
  }

  /**
   * Atualiza configuração
   */
  updateConfig(config: OnlineLearningConfig): void {
    this.config = config;
  }

  /**
   * Limpa histórico de atualizações
   */
  clearHistory(): void {
    this.updateHistory = [];
    console.log('🗑️ Histórico de atualizações limpo');
  }
}
