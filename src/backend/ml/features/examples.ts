/**
 * Exemplo de uso do Pipeline de Feature Engineering e ML
 * Demonstra como integrar o sistema completo no bot trader
 */

import { MLPipeline, ModelType } from './MLPipeline';
import { FeatureEngineering, MultiTimeframeData, OHLCVData } from './FeatureEngineering';

/**
 * Exemplo 1: Treinamento de múltiplos modelos
 */
export async function exampleTrainMultipleModels() {
  console.log('=== EXEMPLO 1: Treinamento de Múltiplos Modelos ===\n');

  // Dados simulados de múltiplos timeframes
  const multiTimeframeData: MultiTimeframeData = {
    '1m': generateMockOHLCV(1000),
    '5m': generateMockOHLCV(200),
    '15m': generateMockOHLCV(100),
    '1h': generateMockOHLCV(50),
  };

  // Criar pipeline
  const pipeline = new MLPipeline({
    sequenceLength: 60,
    lookAhead: 1,
    normalizationMethod: 'zscore',
    balanceClasses: true,
    removeOutliers: true,
  });

  // Inicializar modelos
  const modelTypes: ModelType[] = ['LSTM', 'GRU', 'Transformer', 'XGBoost'];
  pipeline.initializeModels(modelTypes);

  // Treinar cada modelo
  for (const modelType of modelTypes) {
    console.log(`\n🚀 Treinando ${modelType}...`);
    await pipeline.trainModel(modelType, multiTimeframeData, '1m');
  }

  // Salvar modelos treinados
  await pipeline.saveModels('./models');

  console.log('\n✅ Todos os modelos treinados e salvos!\n');
}

/**
 * Exemplo 2: Previsão em tempo real com ensemble
 */
export async function exampleRealtimePrediction() {
  console.log('=== EXEMPLO 2: Previsão em Tempo Real com Ensemble ===\n');

  // Dados em tempo real (últimos 60 candles)
  const realtimeData: MultiTimeframeData = {
    '1m': generateMockOHLCV(60),
    '5m': generateMockOHLCV(20),
    '15m': generateMockOHLCV(10),
  };

  // Criar e carregar pipeline
  const pipeline = new MLPipeline();
  await pipeline.loadModels('./models', ['LSTM', 'GRU', 'Transformer', 'XGBoost']);

  // Fazer previsão ensemble
  const prediction = await pipeline.predictEnsemble(realtimeData, '1m');

  console.log('\n📊 Resultado do Ensemble:');
  console.log(`   Direção: ${prediction.direction}`);
  console.log(`   Confiança: ${(prediction.confidence * 100).toFixed(2)}%`);
  console.log('\n   Previsões individuais:');
  
  prediction.predictions.forEach(pred => {
    console.log(`   - ${pred.model}: ${pred.direction} (${(pred.confidence * 100).toFixed(2)}%)`);
  });

  console.log('\n');
}

/**
 * Exemplo 3: Extração de features avançadas
 */
export function exampleFeatureExtraction() {
  console.log('=== EXEMPLO 3: Extração de Features Avançadas ===\n');

  const featureEngineering = new FeatureEngineering();

  // Dados de múltiplos timeframes
  const multiTimeframeData: MultiTimeframeData = {
    '1m': generateMockOHLCV(100),
    '5m': generateMockOHLCV(50),
    '1h': generateMockOHLCV(24),
  };

  // Extrair todas as features
  const features = featureEngineering.extractAllFeatures(multiTimeframeData, '1m');

  console.log('📊 Features Extraídas:\n');
  
  console.log('1. OHLCV:');
  console.log(`   Close: $${features.ohlcv.close.toFixed(2)}`);
  console.log(`   Volume: ${features.ohlcv.volume.toFixed(2)}`);

  console.log('\n2. Retornos:');
  console.log(`   Simples: ${features.returns.simple.toFixed(2)}%`);
  console.log(`   Logarítmico: ${features.returns.logarithmic.toFixed(2)}%`);
  console.log(`   Rolling 20: ${features.returns.rolling20.toFixed(2)}%`);

  console.log('\n3. Volatilidade:');
  console.log(`   ATR: ${features.volatility.atr.toFixed(2)}`);
  console.log(`   Desvio Padrão: ${features.volatility.stdDev.toFixed(2)}`);
  console.log(`   Volatilidade Histórica: ${features.volatility.historicalVolatility.toFixed(2)}%`);

  console.log('\n4. Indicadores Técnicos:');
  console.log(`   RSI: ${features.indicators.rsi.toFixed(2)}`);
  console.log(`   MACD: ${features.indicators.macd.toFixed(2)}`);
  console.log(`   ADX: ${features.indicators.adx.toFixed(2)}`);
  console.log(`   Bollinger Width: ${features.indicators.bollingerWidth.toFixed(2)}%`);

  console.log('\n5. Derivativos de Preço:');
  console.log(`   Mudança: ${features.priceDerivatives.priceChange.toFixed(2)}%`);
  console.log(`   Slope: ${features.priceDerivatives.priceSlope.toFixed(4)}`);
  console.log(`   Aceleração: ${features.priceDerivatives.acceleration.toFixed(4)}`);

  console.log('\n6. Diferenciais entre Timeframes:');
  console.log(`   Tendência Curto Prazo: ${features.timeframeDifferentials.shortTermTrend.toFixed(2)}%`);
  console.log(`   Tendência Médio Prazo: ${features.timeframeDifferentials.mediumTermTrend.toFixed(2)}%`);
  console.log(`   Tendência Longo Prazo: ${features.timeframeDifferentials.longTermTrend.toFixed(2)}%`);
  console.log(`   Alinhamento: ${features.timeframeDifferentials.trendAlignment}`);

  console.log('\n7. Sinais de Tendência:');
  console.log(`   Direção: ${features.trendSignals.trendDirection}`);
  console.log(`   Força: ${(features.trendSignals.trendStrength * 100).toFixed(2)}%`);
  console.log(`   Consistência: ${(features.trendSignals.trendConsistency * 100).toFixed(2)}%`);

  console.log('\n8. Probabilidade de Reversão:');
  console.log(`   Score de Exaustão: ${(features.reversalProbability.exhaustionScore * 100).toFixed(2)}%`);
  console.log(`   Score de Divergência: ${(features.reversalProbability.divergenceScore * 100).toFixed(2)}%`);
  console.log(`   Squeeze Indicator: ${features.reversalProbability.squeezeIndicator}`);
  console.log(`   Sinal de Reversão: ${(features.reversalProbability.reversalSignal * 100).toFixed(2)}%`);

  // Converter para array numérico
  const featureArray = featureEngineering.featuresToArray(features);
  console.log(`\n📈 Total de features: ${featureArray.length}`);
  console.log('\n');
}

/**
 * Exemplo 4: Avaliação de performance dos modelos
 */
export async function exampleModelEvaluation() {
  console.log('=== EXEMPLO 4: Avaliação de Performance dos Modelos ===\n');

  const multiTimeframeData: MultiTimeframeData = {
    '1m': generateMockOHLCV(1000),
  };

  const pipeline = new MLPipeline();
  await pipeline.loadModels('./models', ['LSTM', 'GRU', 'XGBoost']);

  const modelTypes: ModelType[] = ['LSTM', 'GRU', 'XGBoost'];

  console.log('📊 Avaliando modelos...\n');

  for (const modelType of modelTypes) {
    const metrics = await pipeline.evaluateModel(modelType, multiTimeframeData, '1m');

    console.log(`${modelType}:`);
    console.log(`   Accuracy: ${(metrics.accuracy * 100).toFixed(2)}%`);
    console.log(`   Precision: ${(metrics.precision * 100).toFixed(2)}%`);
    console.log(`   Recall: ${(metrics.recall * 100).toFixed(2)}%`);
    console.log(`   F1-Score: ${(metrics.f1Score * 100).toFixed(2)}%`);
    console.log(`   MAE: ${metrics.mae.toFixed(4)}`);
    console.log(`   RMSE: ${metrics.rmse.toFixed(4)}`);
    console.log('');
  }
}

/**
 * Exemplo 5: Integração com bot trader (uso prático)
 */
export async function exampleBotIntegration() {
  console.log('=== EXEMPLO 5: Integração com Bot Trader ===\n');

  // Simular dados recebidos da exchange
  const liveData: MultiTimeframeData = {
    '1m': generateMockOHLCV(60),
    '5m': generateMockOHLCV(20),
    '15m': generateMockOHLCV(10),
  };

  // Inicializar pipeline
  const pipeline = new MLPipeline({
    sequenceLength: 60,
    lookAhead: 1,
  });

  // Carregar modelos pré-treinados
  await pipeline.loadModels('./models', ['LSTM', 'Transformer', 'XGBoost']);

  // Loop de trading (simulado)
  console.log('🤖 Bot trader em execução...\n');

  for (let i = 0; i < 5; i++) {
    console.log(`\n--- Ciclo ${i + 1} ---`);

    // Fazer previsão ensemble
    const prediction = await pipeline.predictEnsemble(liveData, '1m');

    console.log(`Previsão: ${prediction.direction}`);
    console.log(`Confiança: ${(prediction.confidence * 100).toFixed(2)}%`);

    // Decisão de trading baseada na previsão
    if (prediction.confidence > 0.7) {
      if (prediction.direction === 'UP') {
        console.log('✅ AÇÃO: COMPRAR (alta confiança)');
      } else if (prediction.direction === 'DOWN') {
        console.log('✅ AÇÃO: VENDER (alta confiança)');
      }
    } else {
      console.log('⏸️  AÇÃO: AGUARDAR (confiança baixa)');
    }

    // Simular espera de 1 minuto
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n🏁 Simulação concluída\n');
}

/**
 * Função auxiliar: gera dados OHLCV simulados
 */
function generateMockOHLCV(count: number): OHLCVData[] {
  const data: OHLCVData[] = [];
  let price = 50000; // Preço inicial (ex: BTC)

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 100; // Variação aleatória
    price += change;

    const open = price;
    const close = price + (Math.random() - 0.5) * 50;
    const high = Math.max(open, close) + Math.random() * 20;
    const low = Math.min(open, close) - Math.random() * 20;
    const volume = Math.random() * 1000000;

    data.push({
      timestamp: Date.now() - (count - i) * 60000, // 1 minuto atrás
      open,
      high,
      low,
      close,
      volume,
    });
  }

  return data;
}

/**
 * Executar todos os exemplos
 */
export async function runAllExamples() {
  console.log('\n🚀 INICIANDO EXEMPLOS DE USO DO PIPELINE DE ML\n');
  console.log('='.repeat(60));
  console.log('\n');

  // Exemplo 3 (não precisa de modelos treinados)
  exampleFeatureExtraction();

  console.log('='.repeat(60));
  console.log('\n');

  // Comentar os exemplos que requerem treinamento para demonstração rápida
  // Descomente para treinar e testar modelos reais

  /*
  await exampleTrainMultipleModels();
  console.log('='.repeat(60));
  console.log('\n');

  await exampleRealtimePrediction();
  console.log('='.repeat(60));
  console.log('\n');

  await exampleModelEvaluation();
  console.log('='.repeat(60));
  console.log('\n');

  await exampleBotIntegration();
  */

  console.log('✅ EXEMPLOS CONCLUÍDOS!\n');
}

// Executar se for o arquivo principal
if (require.main === module) {
  runAllExamples().catch(console.error);
}
