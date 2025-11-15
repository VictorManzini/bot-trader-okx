// Lógica de decisão de trading com indicadores técnicos e ajuste dinâmico

import { Candle, TradingSignal, TradingStrategy, DynamicIndicatorConfig, AccountBalance } from '@/types/trading';

// ============================================
// CÁLCULO DE INDICADORES TÉCNICOS
// ============================================

// Calcular RSI (Relative Strength Index)
export function calculateRSI(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) {
    return 50; // Valor neutro se não houver dados suficientes
  }

  const prices = candles.map(c => c.close);
  const changes: number[] = [];

  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  let gains = 0;
  let losses = 0;

  // Primeira média
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) {
      gains += changes[i];
    } else {
      losses += Math.abs(changes[i]);
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Médias subsequentes (suavizadas)
  for (let i = period; i < changes.length; i++) {
    if (changes[i] > 0) {
      avgGain = (avgGain * (period - 1) + changes[i]) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(changes[i])) / period;
    }
  }

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return rsi;
}

// Calcular Média Móvel Simples (SMA)
export function calculateSMA(candles: Candle[], period: number = 20): number {
  if (candles.length < period) {
    return candles[candles.length - 1]?.close || 0;
  }

  const recentCandles = candles.slice(-period);
  const sum = recentCandles.reduce((acc, candle) => acc + candle.close, 0);
  return sum / period;
}

// Calcular Média Móvel Exponencial (EMA)
export function calculateEMA(candles: Candle[], period: number = 20): number {
  if (candles.length < period) {
    return calculateSMA(candles, candles.length);
  }

  const multiplier = 2 / (period + 1);
  let ema = calculateSMA(candles.slice(0, period), period);

  for (let i = period; i < candles.length; i++) {
    ema = (candles[i].close - ema) * multiplier + ema;
  }

  return ema;
}

// Calcular Bandas de Bollinger
export function calculateBollingerBands(
  candles: Candle[],
  period: number = 20,
  stdDev: number = 2
): { upper: number; middle: number; lower: number } {
  const middle = calculateSMA(candles, period);
  
  if (candles.length < period) {
    return { upper: middle, middle, lower: middle };
  }

  const recentCandles = candles.slice(-period);
  const squaredDiffs = recentCandles.map(c => Math.pow(c.close - middle, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const standardDeviation = Math.sqrt(variance);

  return {
    upper: middle + (standardDeviation * stdDev),
    middle,
    lower: middle - (standardDeviation * stdDev),
  };
}

// Calcular MACD (Moving Average Convergence Divergence)
export function calculateMACD(
  candles: Candle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number; signal: number; histogram: number } {
  const fastEMA = calculateEMA(candles, fastPeriod);
  const slowEMA = calculateEMA(candles, slowPeriod);
  const macd = fastEMA - slowEMA;

  // Calcular EMA do MACD (linha de sinal)
  const macdValues: number[] = [];
  for (let i = slowPeriod; i < candles.length; i++) {
    const fast = calculateEMA(candles.slice(0, i + 1), fastPeriod);
    const slow = calculateEMA(candles.slice(0, i + 1), slowPeriod);
    macdValues.push(fast - slow);
  }

  const macdCandles = macdValues.map((value, index) => ({
    timestamp: candles[slowPeriod + index].timestamp,
    open: value,
    high: value,
    low: value,
    close: value,
    volume: 0,
  }));

  const signal = calculateEMA(macdCandles, signalPeriod);
  const histogram = macd - signal;

  return { macd, signal, histogram };
}

// Calcular ATR (Average True Range)
export function calculateATR(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) {
    return 0;
  }

  const trueRanges: number[] = [];
  
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    trueRanges.push(tr);
  }

  const recentTR = trueRanges.slice(-period);
  return recentTR.reduce((a, b) => a + b, 0) / period;
}

// Calcular volatilidade do mercado
export function calculateVolatility(candles: Candle[], period: number = 20): number {
  if (candles.length < period) {
    return 0;
  }

  const recentCandles = candles.slice(-period);
  const returns = recentCandles.slice(1).map((candle, i) => 
    Math.log(candle.close / recentCandles[i].close)
  );

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
  
  return Math.sqrt(variance) * Math.sqrt(252); // Anualizado
}

// ============================================
// AJUSTE DINÂMICO DE INDICADORES
// ============================================

export function getDynamicIndicatorConfig(
  strategy: TradingStrategy,
  candles: Candle[],
  recentPerformance: number = 0
): DynamicIndicatorConfig {
  const volatility = calculateVolatility(candles);
  
  // Configurações base por estratégia
  const baseConfigs = {
    SHORT_TERM: {
      rsiPeriod: 7,
      maPeriod: 10,
      emaPeriod: 12,
      bollingerPeriod: 15,
      bollingerStdDev: 2,
      macdFast: 8,
      macdSlow: 17,
      macdSignal: 9,
      atrPeriod: 10,
    },
    MEDIUM_TERM: {
      rsiPeriod: 14,
      maPeriod: 20,
      emaPeriod: 21,
      bollingerPeriod: 20,
      bollingerStdDev: 2,
      macdFast: 12,
      macdSlow: 26,
      macdSignal: 9,
      atrPeriod: 14,
    },
    LONG_TERM: {
      rsiPeriod: 21,
      maPeriod: 50,
      emaPeriod: 55,
      bollingerPeriod: 30,
      bollingerStdDev: 2.5,
      macdFast: 19,
      macdSlow: 39,
      macdSignal: 9,
      atrPeriod: 21,
    },
  };

  const config = { ...baseConfigs[strategy] };

  // Ajustar com base na volatilidade
  if (volatility > 0.5) {
    // Alta volatilidade - aumentar períodos para suavizar
    config.rsiPeriod = Math.floor(config.rsiPeriod * 1.3);
    config.maPeriod = Math.floor(config.maPeriod * 1.2);
    config.emaPeriod = Math.floor(config.emaPeriod * 1.2);
    config.bollingerStdDev += 0.5;
    config.atrPeriod = Math.floor(config.atrPeriod * 1.2);
  } else if (volatility < 0.2) {
    // Baixa volatilidade - diminuir períodos para mais sensibilidade
    config.rsiPeriod = Math.floor(config.rsiPeriod * 0.8);
    config.maPeriod = Math.floor(config.maPeriod * 0.85);
    config.emaPeriod = Math.floor(config.emaPeriod * 0.85);
    config.bollingerStdDev -= 0.3;
    config.atrPeriod = Math.floor(config.atrPeriod * 0.85);
  }

  // Ajustar com base no desempenho recente
  if (recentPerformance < -5) {
    // Desempenho ruim - ser mais conservador
    config.rsiPeriod = Math.floor(config.rsiPeriod * 1.15);
    config.maPeriod = Math.floor(config.maPeriod * 1.1);
  } else if (recentPerformance > 10) {
    // Bom desempenho - ser mais agressivo
    config.rsiPeriod = Math.floor(config.rsiPeriod * 0.9);
    config.maPeriod = Math.floor(config.maPeriod * 0.95);
  }

  return {
    strategy,
    ...config,
    volatility,
    performance: recentPerformance,
  };
}

// ============================================
// GERAÇÃO DE SINAIS DE TRADING
// ============================================

export function generateTradingSignal(
  candles: Candle[],
  config: DynamicIndicatorConfig
): TradingSignal {
  const currentPrice = candles[candles.length - 1].close;
  
  // Calcular todos os indicadores
  const rsi = calculateRSI(candles, config.rsiPeriod);
  const ma = calculateSMA(candles, config.maPeriod);
  const ema = calculateEMA(candles, config.emaPeriod);
  const bollinger = calculateBollingerBands(candles, config.bollingerPeriod, config.bollingerStdDev);
  const macd = calculateMACD(candles, config.macdFast, config.macdSlow, config.macdSignal);
  const atr = calculateATR(candles, config.atrPeriod);

  let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let reason = 'Aguardando condições favoráveis';
  let confidence = 0;

  // Análise de condições
  const priceAboveMA = currentPrice > ma;
  const priceAboveEMA = currentPrice > ema;
  const rsiOversold = rsi < 30;
  const rsiOverbought = rsi > 70;
  const priceBelowBollingerLower = currentPrice < bollinger.lower;
  const priceAboveBollingerUpper = currentPrice > bollinger.upper;
  const macdBullish = macd.histogram > 0 && macd.macd > macd.signal;
  const macdBearish = macd.histogram < 0 && macd.macd < macd.signal;

  // Sistema de pontuação para decisão
  let buyScore = 0;
  let sellScore = 0;

  // RSI
  if (rsiOversold) buyScore += 25;
  if (rsiOverbought) sellScore += 25;
  if (rsi < 40) buyScore += 10;
  if (rsi > 60) sellScore += 10;

  // Médias Móveis
  if (priceAboveMA && priceAboveEMA) buyScore += 20;
  if (!priceAboveMA && !priceAboveEMA) sellScore += 20;

  // Bandas de Bollinger
  if (priceBelowBollingerLower) buyScore += 20;
  if (priceAboveBollingerUpper) sellScore += 20;

  // MACD
  if (macdBullish) buyScore += 25;
  if (macdBearish) sellScore += 25;

  // Volatilidade (ATR)
  const avgPrice = (candles[candles.length - 1].high + candles[candles.length - 1].low) / 2;
  const atrPercent = (atr / avgPrice) * 100;
  
  if (atrPercent > 3) {
    // Alta volatilidade - reduzir confiança
    buyScore *= 0.8;
    sellScore *= 0.8;
  }

  // Decisão final
  if (buyScore > 60 && buyScore > sellScore) {
    action = 'BUY';
    confidence = Math.min(buyScore, 95);
    reason = `Múltiplos indicadores de compra: RSI=${rsi.toFixed(1)}, MACD bullish, preço favorável`;
  } else if (sellScore > 60 && sellScore > buyScore) {
    action = 'SELL';
    confidence = Math.min(sellScore, 95);
    reason = `Múltiplos indicadores de venda: RSI=${rsi.toFixed(1)}, MACD bearish, preço desfavorável`;
  } else {
    confidence = 50;
    reason = `Sinais mistos - aguardando confirmação (Buy: ${buyScore}, Sell: ${sellScore})`;
  }

  return {
    action,
    reason,
    rsi,
    ma,
    ema,
    currentPrice,
    confidence,
    indicators: {
      bollinger,
      macd,
      atr,
    },
  };
}

// ============================================
// CÁLCULO DINÂMICO DE STOP LOSS E TAKE PROFIT
// ============================================

export function calculateDynamicStopLossTakeProfit(
  entryPrice: number,
  side: 'buy' | 'sell',
  accountBalance: AccountBalance,
  positionAmount: number,
  riskPercentage: number,
  atr: number,
  strategy: TradingStrategy
): { stopLoss: number; takeProfit: number; riskAmount: number } {
  // Calcular valor total da posição
  const positionValue = entryPrice * positionAmount;
  
  // Calcular quanto do patrimônio está em risco
  const maxRiskAmount = accountBalance.totalEquity * (riskPercentage / 100);
  
  // Usar ATR para definir distâncias dinâmicas
  const atrMultiplier = {
    SHORT_TERM: { stopLoss: 1.5, takeProfit: 2.5 },
    MEDIUM_TERM: { stopLoss: 2.0, takeProfit: 3.0 },
    LONG_TERM: { stopLoss: 2.5, takeProfit: 4.0 },
  };

  const multipliers = atrMultiplier[strategy];
  
  // Calcular stop loss baseado em ATR
  const stopLossDistance = atr * multipliers.stopLoss;
  const takeProfitDistance = atr * multipliers.takeProfit;
  
  // Ajustar com base no risco máximo permitido
  const stopLossPercent = (stopLossDistance / entryPrice) * 100;
  const adjustedStopLossPercent = Math.min(
    stopLossPercent,
    (maxRiskAmount / positionValue) * 100
  );

  let stopLoss: number;
  let takeProfit: number;

  if (side === 'buy') {
    stopLoss = entryPrice * (1 - adjustedStopLossPercent / 100);
    takeProfit = entryPrice * (1 + (adjustedStopLossPercent * multipliers.takeProfit / multipliers.stopLoss) / 100);
  } else {
    stopLoss = entryPrice * (1 + adjustedStopLossPercent / 100);
    takeProfit = entryPrice * (1 - (adjustedStopLossPercent * multipliers.takeProfit / multipliers.stopLoss) / 100);
  }

  const riskAmount = Math.abs(entryPrice - stopLoss) * positionAmount;

  return {
    stopLoss,
    takeProfit,
    riskAmount,
  };
}

// ============================================
// CÁLCULO AUTOMÁTICO DO VALOR POR TRADE
// ============================================

export function calculateAutoTradeAmount(
  entryPrice: number,
  side: 'buy' | 'sell',
  accountBalance: AccountBalance,
  strategy: TradingStrategy,
  atr: number,
  riskPercentage: number,
  signal: TradingSignal
): {
  tradeAmount: number;
  stopLoss: number;
  takeProfit: number;
  riskAmount: number;
  reasoning: string;
} {
  // 1. Calcular o risco máximo baseado no patrimônio
  const maxRiskAmount = accountBalance.totalEquity * (riskPercentage / 100);
  
  // 2. Definir multiplicadores baseados na estratégia
  const strategyMultipliers = {
    SHORT_TERM: { 
      stopLoss: 1.5, 
      takeProfit: 2.5,
      baseRiskMultiplier: 1.0 
    },
    MEDIUM_TERM: { 
      stopLoss: 2.0, 
      takeProfit: 3.0,
      baseRiskMultiplier: 0.85 
    },
    LONG_TERM: { 
      stopLoss: 2.5, 
      takeProfit: 4.0,
      baseRiskMultiplier: 0.7 
    },
  };

  const multipliers = strategyMultipliers[strategy];
  
  // 3. Calcular distância do stop loss baseado em ATR
  const stopLossDistance = atr * multipliers.stopLoss;
  const takeProfitDistance = atr * multipliers.takeProfit;
  
  // 4. Calcular níveis de SL e TP
  let stopLoss: number;
  let takeProfit: number;
  
  if (side === 'buy') {
    stopLoss = entryPrice - stopLossDistance;
    takeProfit = entryPrice + takeProfitDistance;
  } else {
    stopLoss = entryPrice + stopLossDistance;
    takeProfit = entryPrice - takeProfitDistance;
  }
  
  // 5. Calcular quantidade baseada no risco por unidade
  const riskPerUnit = Math.abs(entryPrice - stopLoss);
  
  // Evitar divisão por zero
  if (riskPerUnit === 0) {
    return {
      tradeAmount: 0,
      stopLoss,
      takeProfit,
      riskAmount: 0,
      reasoning: 'Risco por unidade é zero - impossível calcular quantidade',
    };
  }
  
  // 6. Ajustar quantidade baseado na confiança do sinal
  const confidenceMultiplier = signal.confidence / 100;
  
  // 7. Ajustar baseado na volatilidade (ATR)
  const avgPrice = entryPrice;
  const atrPercent = (atr / avgPrice) * 100;
  let volatilityMultiplier = 1.0;
  
  if (atrPercent > 5) {
    // Alta volatilidade - reduzir exposição
    volatilityMultiplier = 0.6;
  } else if (atrPercent > 3) {
    volatilityMultiplier = 0.8;
  } else if (atrPercent < 1) {
    // Baixa volatilidade - pode aumentar exposição
    volatilityMultiplier = 1.2;
  }
  
  // 8. Calcular quantidade ajustada
  const adjustedRiskAmount = maxRiskAmount * 
    multipliers.baseRiskMultiplier * 
    confidenceMultiplier * 
    volatilityMultiplier;
  
  let tradeAmount = adjustedRiskAmount / riskPerUnit;
  
  // 9. Limitar ao saldo disponível
  const maxAffordableAmount = accountBalance.availableBalance / entryPrice;
  tradeAmount = Math.min(tradeAmount, maxAffordableAmount * 0.95); // 95% para margem de segurança
  
  // 10. Verificar se há posição existente do ativo
  const symbol = Object.keys(accountBalance.positions)[0]; // Simplificado
  if (symbol && accountBalance.positions[symbol]) {
    const existingPosition = accountBalance.positions[symbol];
    // Ajustar para não ultrapassar concentração máxima (30% do patrimônio em um ativo)
    const maxConcentration = accountBalance.totalEquity * 0.3;
    const currentExposure = existingPosition.currentValue;
    const newExposure = tradeAmount * entryPrice;
    
    if (currentExposure + newExposure > maxConcentration) {
      tradeAmount = Math.max(0, (maxConcentration - currentExposure) / entryPrice);
    }
  }
  
  // 11. Arredondar para precisão adequada
  tradeAmount = Math.floor(tradeAmount * 100000) / 100000;
  
  const riskAmount = Math.abs(entryPrice - stopLoss) * tradeAmount;
  
  // 12. Gerar explicação do cálculo
  const reasoning = `
    Valor calculado automaticamente:
    • Patrimônio: $${accountBalance.totalEquity.toFixed(2)}
    • Risco máximo (${riskPercentage}%): $${maxRiskAmount.toFixed(2)}
    • Estratégia: ${strategy} (multiplicador: ${multipliers.baseRiskMultiplier})
    • ATR: ${atr.toFixed(4)} (${atrPercent.toFixed(2)}% - volatilidade ${atrPercent > 3 ? 'alta' : atrPercent < 1 ? 'baixa' : 'média'})
    • Confiança do sinal: ${signal.confidence.toFixed(1)}%
    • Ajuste volatilidade: ${(volatilityMultiplier * 100).toFixed(0)}%
    • Distância SL: $${stopLossDistance.toFixed(4)}
    • Risco por unidade: $${riskPerUnit.toFixed(4)}
    • Quantidade final: ${tradeAmount.toFixed(5)} unidades
    • Valor da operação: $${(tradeAmount * entryPrice).toFixed(2)}
    • Risco efetivo: $${riskAmount.toFixed(2)}
  `.trim();
  
  return {
    tradeAmount,
    stopLoss,
    takeProfit,
    riskAmount,
    reasoning,
  };
}

// Verificar se deve fechar posição
export function shouldClosePosition(
  currentPrice: number,
  entryPrice: number,
  side: 'buy' | 'sell',
  stopLoss: number,
  takeProfit: number
): { shouldClose: boolean; reason: string } {
  if (side === 'buy') {
    if (currentPrice <= stopLoss) {
      return { shouldClose: true, reason: 'Stop Loss atingido' };
    }
    if (currentPrice >= takeProfit) {
      return { shouldClose: true, reason: 'Take Profit atingido' };
    }
  } else {
    if (currentPrice >= stopLoss) {
      return { shouldClose: true, reason: 'Stop Loss atingido' };
    }
    if (currentPrice <= takeProfit) {
      return { shouldClose: true, reason: 'Take Profit atingido' };
    }
  }

  return { shouldClose: false, reason: '' };
}

// Calcular tamanho ideal da posição baseado no risco
export function calculatePositionSize(
  accountBalance: AccountBalance,
  entryPrice: number,
  stopLoss: number,
  riskPercentage: number
): number {
  const riskAmount = accountBalance.totalEquity * (riskPercentage / 100);
  const priceRisk = Math.abs(entryPrice - stopLoss);
  
  if (priceRisk === 0) return 0;
  
  const positionSize = riskAmount / priceRisk;
  
  // Limitar ao saldo disponível
  const maxPositionSize = accountBalance.availableBalance / entryPrice;
  
  return Math.min(positionSize, maxPositionSize * 0.95); // 95% do máximo para margem de segurança
}
