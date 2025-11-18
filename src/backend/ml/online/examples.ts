/**
 * Exemplo de Uso - Online Learning
 * Demonstra como integrar o sistema de aprendizado contínuo no bot trader
 */

import { MLPipeline } from '../features/MLPipeline';
import { OnlineLearningManager } from './OnlineLearningManager';
import { MultiTimeframeData } from '../features/FeatureEngineering';

/**
 * EXEMPLO 1: Configuração Básica
 */
export async function setupOnlineLearning() {
  // 1. Criar pipeline de ML
  const mlPipeline = new MLPipeline({
    modelType: 'LSTM',
    sequenceLength: 60,
    lookAhead: 1,
  });

  // 2. Inicializar modelos
  mlPipeline.initializeModels(['LSTM', 'XGBoost', 'GRU']);

  // 3. Criar gerenciador de aprendizado contínuo
  const onlineLearning = new OnlineLearningManager(mlPipeline, {
    updateFrequency: 'window', // Atualizar em janelas de tempo
    windowSize: 100, // 100 candles para retreinamento
    minSamplesForUpdate: 50, // Mínimo 50 amostras
    updateInterval: 3600000, // 1 hora
    enableAutoRetrain: true,
    performanceThreshold: 0.55, // 55% de accuracy mínima
    modelTypes: ['LSTM', 'XGBoost', 'GRU'],
  });

  console.log('✅ Online Learning configurado');
  return { mlPipeline, onlineLearning };
}

/**
 * EXEMPLO 2: Fazer Previsão e Registrar
 */
export async function makePredictionAndLog(
  mlPipeline: MLPipeline,
  onlineLearning: OnlineLearningManager,
  multiTimeframeData: MultiTimeframeData,
  currentPrice: number,
  symbol: string,
  timeframe: string
) {
  // 1. Fazer previsão ensemble
  const prediction = await mlPipeline.predictEnsemble(multiTimeframeData);

  console.log('🔮 Previsão:', prediction.direction);
  console.log('📊 Confiança:', (prediction.confidence * 100).toFixed(2) + '%');

  // 2. Registrar previsão
  const predictionId = await onlineLearning.logPrediction(
    prediction,
    currentPrice,
    symbol,
    timeframe
  );

  console.log('📝 Previsão registrada:', predictionId);

  return predictionId;
}

/**
 * EXEMPLO 3: Avaliar Previsão após N candles
 */
export async function evaluatePredictionAfterCandles(
  onlineLearning: OnlineLearningManager,
  predictionId: string,
  actualPrice: number
) {
  // Avaliar previsão com preço real
  await onlineLearning.evaluatePrediction(predictionId, actualPrice);

  // Ver estatísticas
  const stats = onlineLearning.getPerformanceStats();
  console.log('📊 Performance Geral:');
  console.log('   Accuracy:', (stats.overall.accuracy * 100).toFixed(2) + '%');
  console.log('   Win Rate:', (stats.overall.winRate * 100).toFixed(2) + '%');
  console.log('   Avg PnL:', stats.overall.avgPnlPercentage.toFixed(2) + '%');
  console.log('   Sharpe Ratio:', stats.overall.sharpeRatio.toFixed(2));
}

/**
 * EXEMPLO 4: Processar Novo Candle (Atualização Automática)
 */
export async function processNewCandleWithOnlineLearning(
  onlineLearning: OnlineLearningManager,
  multiTimeframeData: MultiTimeframeData,
  symbol: string,
  timeframe: string
) {
  // Processar novo candle
  await onlineLearning.processNewCandle(multiTimeframeData, symbol, timeframe);

  // Sistema automaticamente verifica se precisa retreinar
  console.log('✅ Candle processado');
}

/**
 * EXEMPLO 5: Forçar Atualização Manual
 */
export async function forceModelUpdate(
  onlineLearning: OnlineLearningManager,
  multiTimeframeData: MultiTimeframeData
) {
  console.log('🔄 Forçando atualização manual dos modelos...');
  
  await onlineLearning.forceUpdate(multiTimeframeData);

  console.log('✅ Modelos atualizados manualmente');
}

/**
 * EXEMPLO 6: Monitorar Performance em Tempo Real
 */
export function monitorPerformance(onlineLearning: OnlineLearningManager) {
  const stats = onlineLearning.getPerformanceStats();

  console.log('\n📊 === PERFORMANCE REPORT ===');
  console.log('Overall Performance:');
  console.log('  Accuracy:', (stats.overall.accuracy * 100).toFixed(2) + '%');
  console.log('  Precision:', (stats.overall.precision * 100).toFixed(2) + '%');
  console.log('  Recall:', (stats.overall.recall * 100).toFixed(2) + '%');
  console.log('  F1 Score:', (stats.overall.f1Score * 100).toFixed(2) + '%');
  console.log('  Win Rate:', (stats.overall.winRate * 100).toFixed(2) + '%');
  console.log('  Avg PnL:', stats.overall.avgPnlPercentage.toFixed(2) + '%');
  console.log('  Sharpe Ratio:', stats.overall.sharpeRatio.toFixed(2));

  console.log('\nPer Model Performance:');
  for (const [model, perf] of stats.byModel) {
    console.log(`  ${model}:`, (perf.accuracy * 100).toFixed(2) + '%');
  }

  console.log('\nPredictions:');
  console.log('  Total:', stats.totalPredictions);
  console.log('  Recent:', stats.recentPredictions);
  console.log('  Last Update:', new Date(stats.lastUpdate).toLocaleString());
  console.log('=========================\n');
}

/**
 * EXEMPLO 7: Integração Completa no Loop de Trading
 */
export async function tradingLoopWithOnlineLearning() {
  // Setup inicial
  const { mlPipeline, onlineLearning } = await setupOnlineLearning();

  // Dados de exemplo (substituir por dados reais da exchange)
  const multiTimeframeData: MultiTimeframeData = {
    '1m': [], // Preencher com dados reais
    '5m': [],
    '15m': [],
  };

  const symbol = 'BTC-USDT';
  const timeframe = '1m';
  let currentPrice = 50000;

  // Mapa para rastrear previsões pendentes
  const pendingPredictions = new Map<string, number>();

  // Simular loop de trading
  for (let i = 0; i < 100; i++) {
    console.log(`\n=== Candle ${i + 1} ===`);

    // 1. Fazer previsão
    const predictionId = await makePredictionAndLog(
      mlPipeline,
      onlineLearning,
      multiTimeframeData,
      currentPrice,
      symbol,
      timeframe
    );

    // Guardar previsão para avaliar depois
    pendingPredictions.set(predictionId, currentPrice);

    // 2. Simular passagem de tempo (1 candle)
    await new Promise(resolve => setTimeout(resolve, 100));

    // 3. Simular novo preço
    currentPrice = currentPrice * (1 + (Math.random() - 0.5) * 0.02);

    // 4. Avaliar previsões antigas (após N candles)
    const lookbackCandles = 5;
    if (i >= lookbackCandles) {
      const oldPredictions = Array.from(pendingPredictions.entries()).slice(0, 1);
      
      for (const [predId, oldPrice] of oldPredictions) {
        await evaluatePredictionAfterCandles(
          onlineLearning,
          predId,
          currentPrice
        );
        pendingPredictions.delete(predId);
      }
    }

    // 5. Processar novo candle (pode triggerar retreinamento)
    await processNewCandleWithOnlineLearning(
      onlineLearning,
      multiTimeframeData,
      symbol,
      timeframe
    );

    // 6. Monitorar performance a cada 10 candles
    if ((i + 1) % 10 === 0) {
      monitorPerformance(onlineLearning);
    }
  }

  console.log('\n✅ Trading loop concluído');
}

/**
 * EXEMPLO 8: Exportar Dados para Análise
 */
export function exportTrainingData(onlineLearning: OnlineLearningManager) {
  const data = onlineLearning.exportTrainingData();

  console.log('📦 Dados exportados:');
  console.log('  Previsões:', data.predictions.length);
  console.log('  Accuracy:', (data.performance.accuracy * 100).toFixed(2) + '%');
  console.log('  Configuração:', data.config);

  // Salvar em arquivo (exemplo)
  // fs.writeFileSync('training_data.json', JSON.stringify(data, null, 2));

  return data;
}

/**
 * EXEMPLO 9: Configuração para Diferentes Estratégias
 */
export function createOnlineLearningForStrategy(
  mlPipeline: MLPipeline,
  strategy: 'aggressive' | 'conservative' | 'balanced'
) {
  const configs = {
    aggressive: {
      updateFrequency: 'candle' as const,
      windowSize: 50,
      minSamplesForUpdate: 30,
      updateInterval: 1800000, // 30 min
      performanceThreshold: 0.50,
    },
    conservative: {
      updateFrequency: 'window' as const,
      windowSize: 200,
      minSamplesForUpdate: 100,
      updateInterval: 7200000, // 2 horas
      performanceThreshold: 0.60,
    },
    balanced: {
      updateFrequency: 'window' as const,
      windowSize: 100,
      minSamplesForUpdate: 50,
      updateInterval: 3600000, // 1 hora
      performanceThreshold: 0.55,
    },
  };

  const config = configs[strategy];

  return new OnlineLearningManager(mlPipeline, {
    ...config,
    enableAutoRetrain: true,
    maxPredictionHistory: 10000,
    modelTypes: ['LSTM', 'XGBoost', 'GRU'],
  });
}

// Executar exemplo (descomentar para testar)
// tradingLoopWithOnlineLearning().catch(console.error);
