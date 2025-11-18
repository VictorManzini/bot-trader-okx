/**
 * Feature Engineering Module - Index
 * Exporta todos os componentes do sistema de Feature Engineering
 */

// Feature Engineering
export {
  FeatureEngineering,
  OHLCVData,
  MultiTimeframeData,
  AdvancedFeatures,
} from './FeatureEngineering';

// Data Preparation
export {
  DataPreparation,
  DatasetSplit,
  NormalizationParams,
} from './DataPreparation';

// ML Pipeline
export {
  MLPipeline,
  ModelType,
  PipelineConfig,
  PredictionEnsemble,
} from './MLPipeline';

// Exemplos (para referência)
export {
  exampleFeatureExtraction,
  exampleTrainMultipleModels,
  exampleRealtimePrediction,
  exampleModelEvaluation,
  exampleBotIntegration,
  runAllExamples,
} from './examples';
