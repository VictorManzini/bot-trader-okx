/**
 * Exemplos de Uso - Pattern Detection
 */

import { PatternDetector, OHLCVData, PatternFeatures } from './index';

// ============================================
// EXEMPLO 1: Detecção Básica de Padrões
// ============================================

async function exemploDeteccaoBasica() {
  console.log('📊 EXEMPLO 1: Detecção Básica de Padrões\n');

  // Dados OHLCV simulados
  const dadosOHLCV: OHLCVData[] = [
    { timestamp: 1000, open: 100, high: 105, low: 98, close: 103, volume: 1000 },
    { timestamp: 2000, open: 103, high: 107, low: 102, close: 106, volume: 1200 },
    { timestamp: 3000, open: 106, high: 108, low: 104, close: 105, volume: 900 },
    { timestamp: 4000, open: 105, high: 110, low: 103, close: 109, volume: 1500 },
    { timestamp: 5000, open: 109, high: 112, low: 108, close: 111, volume: 1300 },
    // ... adicione mais dados para melhor detecção
  ];

  // Criar detector
  const detector = new PatternDetector({
    enableCandlePatterns: true,
    enableChartPatterns: true,
    enableCNN: false, // Desabilitado por padrão
    minConfidence: 0.6,
    lookbackPeriod: 100,
  });

  // Detectar padrões
  const resultado = await detector.detectAllPatterns(dadosOHLCV);

  console.log('🕯️ Padrões de Candles Detectados:', resultado.candlePatterns.length);
  resultado.candlePatterns.forEach(pattern => {
    console.log(`  - ${pattern.type}: ${pattern.direction} (${(pattern.confidence * 100).toFixed(1)}%)`);
    console.log(`    ${pattern.description}`);
  });

  console.log('\n📈 Padrões Gráficos Detectados:', resultado.chartPatterns.length);
  resultado.chartPatterns.forEach(pattern => {
    console.log(`  - ${pattern.type}: ${pattern.direction} (${(pattern.confidence * 100).toFixed(1)}%)`);
    console.log(`    ${pattern.description}`);
    if (pattern.keyLevels.target) {
      console.log(`    Target: ${pattern.keyLevels.target.toFixed(2)}`);
    }
  });

  console.log('\n🎯 Sinal Geral:');
  console.log(`  Direção: ${resultado.overallSignal.direction}`);
  console.log(`  Força: ${(resultado.overallSignal.strength * 100).toFixed(1)}%`);
  console.log(`  Confiança: ${(resultado.overallSignal.confidence * 100).toFixed(1)}%`);
}

// ============================================
// EXEMPLO 2: Extração de Features para ML
// ============================================

function exemploExtracaoFeatures() {
  console.log('\n\n🔬 EXEMPLO 2: Extração de Features para ML\n');

  const dadosOHLCV: OHLCVData[] = [
    { timestamp: 1000, open: 100, high: 105, low: 98, close: 103, volume: 1000 },
    { timestamp: 2000, open: 103, high: 107, low: 102, close: 106, volume: 1200 },
    { timestamp: 3000, open: 106, high: 108, low: 104, close: 105, volume: 900 },
    // ... mais dados
  ];

  const detector = new PatternDetector();

  // Extrair features de padrões
  const features: PatternFeatures = detector.extractPatternFeatures(dadosOHLCV);

  console.log('📊 Features de Padrões:');
  console.log('  Padrões de Candles:');
  console.log(`    - Doji: ${features.hasDoji ? 'Sim' : 'Não'}`);
  console.log(`    - Hammer: ${features.hasHammer ? 'Sim' : 'Não'}`);
  console.log(`    - Engulfing: ${features.hasEngulfing ? 'Sim' : 'Não'}`);
  console.log(`    - Morning Star: ${features.hasMorningStar ? 'Sim' : 'Não'}`);
  console.log(`    - Evening Star: ${features.hasEveningStar ? 'Sim' : 'Não'}`);

  console.log('\n  Padrões Gráficos:');
  console.log(`    - Head and Shoulders: ${features.hasHeadAndShoulders ? 'Sim' : 'Não'}`);
  console.log(`    - Double Top: ${features.hasDoubleTop ? 'Sim' : 'Não'}`);
  console.log(`    - Double Bottom: ${features.hasDoubleBottom ? 'Sim' : 'Não'}`);
  console.log(`    - Triangle: ${features.hasTriangle ? 'Sim' : 'Não'}`);
  console.log(`    - Flag: ${features.hasFlag ? 'Sim' : 'Não'}`);
  console.log(`    - Cup and Handle: ${features.hasCupAndHandle ? 'Sim' : 'Não'}`);

  console.log('\n  Scores:');
  console.log(`    - Bullish Candle Score: ${features.bullishCandleScore.toFixed(2)}`);
  console.log(`    - Bearish Candle Score: ${features.bearishCandleScore.toFixed(2)}`);
  console.log(`    - Bullish Chart Score: ${features.bullishChartScore.toFixed(2)}`);
  console.log(`    - Bearish Chart Score: ${features.bearishChartScore.toFixed(2)}`);

  console.log('\n  Sinal Combinado:');
  console.log(`    - Combined Signal: ${features.combinedSignal.toFixed(2)} (-1 a 1)`);
  console.log(`    - Pattern Strength: ${(features.patternStrength * 100).toFixed(1)}%`);

  // Converter para array numérico (para alimentar modelos de ML)
  const featuresArray = detector.patternFeaturesToArray(features);
  console.log('\n  Array de Features (para ML):');
  console.log(`    [${featuresArray.map(f => f.toFixed(2)).join(', ')}]`);
}

// ============================================
// EXEMPLO 3: Integração com Trading Bot
// ============================================

async function exemploIntegracaoBot() {
  console.log('\n\n🤖 EXEMPLO 3: Integração com Trading Bot\n');

  // Simular dados de mercado em tempo real
  const dadosMercado: OHLCVData[] = [
    // ... dados históricos dos últimos 100 candles
    { timestamp: Date.now() - 100000, open: 50000, high: 50500, low: 49800, close: 50200, volume: 100 },
    { timestamp: Date.now() - 90000, open: 50200, high: 50800, low: 50100, close: 50600, volume: 120 },
    // ... mais dados
    { timestamp: Date.now(), open: 51000, high: 51200, low: 50900, close: 51100, volume: 150 },
  ];

  const detector = new PatternDetector({
    enableCandlePatterns: true,
    enableChartPatterns: true,
    minConfidence: 0.7, // Confiança mais alta para trading
  });

  // Detectar padrões
  const resultado = await detector.detectAllPatterns(dadosMercado);

  // Lógica de decisão do bot
  console.log('🎯 Análise de Padrões para Trading:');

  if (resultado.overallSignal.direction === 'BULLISH' && resultado.overallSignal.strength > 0.7) {
    console.log('✅ SINAL DE COMPRA FORTE');
    console.log(`   Confiança: ${(resultado.overallSignal.confidence * 100).toFixed(1)}%`);
    console.log('   Padrões detectados:');
    resultado.candlePatterns
      .filter(p => p.direction === 'BULLISH')
      .forEach(p => console.log(`     - ${p.type}`));
    resultado.chartPatterns
      .filter(p => p.direction === 'BULLISH')
      .forEach(p => console.log(`     - ${p.type}`));
  } else if (resultado.overallSignal.direction === 'BEARISH' && resultado.overallSignal.strength > 0.7) {
    console.log('🔴 SINAL DE VENDA FORTE');
    console.log(`   Confiança: ${(resultado.overallSignal.confidence * 100).toFixed(1)}%`);
    console.log('   Padrões detectados:');
    resultado.candlePatterns
      .filter(p => p.direction === 'BEARISH')
      .forEach(p => console.log(`     - ${p.type}`));
    resultado.chartPatterns
      .filter(p => p.direction === 'BEARISH')
      .forEach(p => console.log(`     - ${p.type}`));
  } else {
    console.log('⚠️ SINAL NEUTRO - Aguardar');
    console.log(`   Força do sinal: ${(resultado.overallSignal.strength * 100).toFixed(1)}%`);
  }

  // Definir níveis de stop loss e take profit baseados em padrões gráficos
  const padraoComNiveis = resultado.chartPatterns.find(p => p.keyLevels.target);
  if (padraoComNiveis) {
    console.log('\n📍 Níveis Sugeridos:');
    if (padraoComNiveis.keyLevels.support) {
      console.log(`   Stop Loss: ${padraoComNiveis.keyLevels.support.toFixed(2)}`);
    }
    if (padraoComNiveis.keyLevels.target) {
      console.log(`   Take Profit: ${padraoComNiveis.keyLevels.target.toFixed(2)}`);
    }
  }
}

// ============================================
// EXEMPLO 4: Detecção com CNN (Avançado)
// ============================================

async function exemploDeteccaoComCNN() {
  console.log('\n\n🧠 EXEMPLO 4: Detecção com CNN (Avançado)\n');

  const detector = new PatternDetector({
    enableCandlePatterns: true,
    enableChartPatterns: true,
    enableCNN: true, // Habilitar CNN
    minConfidence: 0.65,
  });

  // Inicializar CNN
  console.log('🔄 Inicializando modelo CNN...');
  await detector.initializeCNN();

  // Dados de mercado
  const dadosOHLCV: OHLCVData[] = [
    // ... dados históricos
  ];

  // Detectar padrões (agora inclui CNN)
  const resultado = await detector.detectAllPatterns(dadosOHLCV);

  console.log('🕯️ Padrões de Candles:', resultado.candlePatterns.length);
  console.log('📈 Padrões Gráficos:', resultado.chartPatterns.length);
  console.log('🧠 Padrões CNN:', resultado.cnnPatterns?.length || 0);

  console.log('\n🎯 Sinal Combinado (Regras + CNN):');
  console.log(`  Direção: ${resultado.overallSignal.direction}`);
  console.log(`  Força: ${(resultado.overallSignal.strength * 100).toFixed(1)}%`);
  console.log(`  Confiança: ${(resultado.overallSignal.confidence * 100).toFixed(1)}%`);

  // Limpar recursos
  detector.dispose();
}

// ============================================
// EXEMPLO 5: Monitoramento Contínuo
// ============================================

async function exemploMonitoramentoContinuo() {
  console.log('\n\n⏰ EXEMPLO 5: Monitoramento Contínuo\n');

  const detector = new PatternDetector({
    enableCandlePatterns: true,
    enableChartPatterns: true,
    minConfidence: 0.7,
  });

  // Simular monitoramento a cada novo candle
  let dadosHistoricos: OHLCVData[] = [];

  const monitorar = async (novoCandle: OHLCVData) => {
    // Adicionar novo candle
    dadosHistoricos.push(novoCandle);

    // Manter apenas últimos 100 candles
    if (dadosHistoricos.length > 100) {
      dadosHistoricos = dadosHistoricos.slice(-100);
    }

    // Detectar padrões
    const resultado = await detector.detectAllPatterns(dadosHistoricos);

    // Alertar sobre novos padrões importantes
    const padroesImportantes = [
      ...resultado.candlePatterns.filter(p => p.confidence > 0.8),
      ...resultado.chartPatterns.filter(p => p.confidence > 0.8),
    ];

    if (padroesImportantes.length > 0) {
      console.log(`\n🔔 ALERTA - ${new Date(novoCandle.timestamp).toLocaleTimeString()}`);
      console.log(`   Padrões de alta confiança detectados:`);
      padroesImportantes.forEach(p => {
        console.log(`   - ${p.type}: ${p.direction} (${(p.confidence * 100).toFixed(1)}%)`);
      });
    }

    // Verificar mudança de sinal
    if (resultado.overallSignal.strength > 0.75) {
      console.log(`\n📊 Sinal forte: ${resultado.overallSignal.direction}`);
    }
  };

  // Simular chegada de novos candles
  console.log('🔄 Iniciando monitoramento...');
  console.log('   (Simulando novos candles a cada segundo)\n');

  // Exemplo de uso:
  // setInterval(() => {
  //   const novoCandle: OHLCVData = {
  //     timestamp: Date.now(),
  //     open: Math.random() * 1000 + 50000,
  //     high: Math.random() * 1000 + 50500,
  //     low: Math.random() * 1000 + 49500,
  //     close: Math.random() * 1000 + 50000,
  //     volume: Math.random() * 100 + 50,
  //   };
  //   monitorar(novoCandle);
  // }, 1000);
}

// ============================================
// Executar exemplos
// ============================================

export async function executarExemplos() {
  console.log('═══════════════════════════════════════════════');
  console.log('  EXEMPLOS DE DETECÇÃO DE PADRÕES');
  console.log('═══════════════════════════════════════════════\n');

  try {
    await exemploDeteccaoBasica();
    exemploExtracaoFeatures();
    await exemploIntegracaoBot();
    // await exemploDeteccaoComCNN(); // Descomente para testar CNN
    // await exemploMonitoramentoContinuo(); // Descomente para monitoramento

    console.log('\n\n✅ Todos os exemplos executados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao executar exemplos:', error);
  }
}

// Executar se for chamado diretamente
if (require.main === module) {
  executarExemplos();
}
