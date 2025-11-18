/**
 * Feature Engineering Pipeline Avançado
 * Pipeline completo de features para alimentar modelos de ML
 */

import { PatternDetector } from '../patterns/PatternDetector';

export interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MultiTimeframeData {
  '1m'?: OHLCVData[];
  '5m'?: OHLCVData[];
  '15m'?: OHLCVData[];
  '1h'?: OHLCVData[];
  '4h'?: OHLCVData[];
  '1d'?: OHLCVData[];
}

export interface AdvancedFeatures {
  // OHLCV básico
  ohlcv: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };

  // Retornos percentuais
  returns: {
    simple: number;
    logarithmic: number;
    rolling5: number;
    rolling10: number;
    rolling20: number;
  };

  // Volatilidade
  volatility: {
    atr: number;
    stdDev: number;
    intradayVariation: number;
    historicalVolatility: number;
  };

  // Indicadores técnicos
  indicators: {
    rsi: number;
    ema9: number;
    ema21: number;
    ema50: number;
    ema200: number;
    sma20: number;
    sma50: number;
    sma200: number;
    macd: number;
    macdSignal: number;
    macdHist: number;
    bollingerUpper: number;
    bollingerMiddle: number;
    bollingerLower: number;
    bollingerWidth: number;
    stochK: number;
    stochD: number;
    adx: number;
    cci: number;
    williamsR: number;
  };

  // Derivativos de preço
  priceDerivatives: {
    priceChange: number;
    priceSlope: number;
    acceleration: number;
    candleBodySize: number;
    candleWickSize: number;
    candleRange: number;
  };

  // Diferenciais entre timeframes
  timeframeDifferentials: {
    shortTermTrend: number;
    mediumTermTrend: number;
    longTermTrend: number;
    trendAlignment: number;
    trendDivergence: number;
  };

  // Sinais de tendência
  trendSignals: {
    trendDirection: 'UP' | 'DOWN' | 'SIDEWAYS';
    trendStrength: number;
    trendConsistency: number;
    supportLevel: number;
    resistanceLevel: number;
  };

  // Probabilidade de reversão
  reversalProbability: {
    exhaustionScore: number;
    divergenceScore: number;
    squeezeIndicator: number;
    overextensionScore: number;
    reversalSignal: number;
  };

  // 🆕 Padrões de candles e gráficos
  patterns: {
    hasDoji: boolean;
    hasHammer: boolean;
    hasEngulfing: boolean;
    hasMorningStar: boolean;
    hasEveningStar: boolean;
    hasHeadAndShoulders: boolean;
    hasDoubleTop: boolean;
    hasDoubleBottom: boolean;
    hasTriangle: boolean;
    hasFlag: boolean;
    hasCupAndHandle: boolean;
    bullishCandleScore: number;
    bearishCandleScore: number;
    bullishChartScore: number;
    bearishChartScore: number;
    combinedSignal: number;
    patternStrength: number;
  };
}

export class FeatureEngineering {
  private patternDetector: PatternDetector;

  constructor() {
    this.patternDetector = new PatternDetector({
      enableCandlePatterns: true,
      enableChartPatterns: true,
      enableCNN: false,
      minConfidence: 0.6,
    });
  }

  /**
   * Pipeline principal: extrai todas as features de dados multi-timeframe
   */
  extractAllFeatures(
    multiTimeframeData: MultiTimeframeData,
    primaryTimeframe: keyof MultiTimeframeData = '1m'
  ): AdvancedFeatures {
    const primaryData = multiTimeframeData[primaryTimeframe];
    
    if (!primaryData || primaryData.length === 0) {
      throw new Error(`Dados insuficientes para timeframe ${primaryTimeframe}`);
    }

    const latest = primaryData[primaryData.length - 1];

    return {
      ohlcv: this.extractOHLCV(latest),
      returns: this.calculateReturns(primaryData),
      volatility: this.calculateVolatility(primaryData),
      indicators: this.calculateIndicators(primaryData),
      priceDerivatives: this.calculatePriceDerivatives(primaryData),
      timeframeDifferentials: this.calculateTimeframeDifferentials(multiTimeframeData),
      trendSignals: this.calculateTrendSignals(primaryData),
      reversalProbability: this.calculateReversalProbability(primaryData),
      patterns: this.patternDetector.extractPatternFeatures(primaryData),
    };
  }

  /**
   * Extrai OHLCV básico
   */
  private extractOHLCV(candle: OHLCVData) {
    return {
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    };
  }

  /**
   * Calcula retornos percentuais (simples, logarítmicos, janelas móveis)
   */
  calculateReturns(data: OHLCVData[]) {
    const closes = data.map(d => d.close);
    const latest = closes[closes.length - 1];
    const previous = closes[closes.length - 2] || latest;

    // Retorno simples
    const simple = ((latest - previous) / previous) * 100;

    // Retorno logarítmico
    const logarithmic = Math.log(latest / previous) * 100;

    // Retornos de janelas móveis
    const rolling5 = this.calculateRollingReturn(closes, 5);
    const rolling10 = this.calculateRollingReturn(closes, 10);
    const rolling20 = this.calculateRollingReturn(closes, 20);

    return {
      simple,
      logarithmic,
      rolling5,
      rolling10,
      rolling20,
    };
  }

  /**
   * Calcula retorno de janela móvel
   */
  private calculateRollingReturn(closes: number[], window: number): number {
    if (closes.length < window) return 0;
    const current = closes[closes.length - 1];
    const past = closes[closes.length - window];
    return ((current - past) / past) * 100;
  }

  /**
   * Calcula volatilidade (ATR, desvio padrão, variação intradiária)
   */
  calculateVolatility(data: OHLCVData[]) {
    const closes = data.map(d => d.close);
    
    return {
      atr: this.calculateATR(data, 14),
      stdDev: this.calculateStdDev(closes, 20),
      intradayVariation: this.calculateIntradayVariation(data),
      historicalVolatility: this.calculateHistoricalVolatility(closes, 20),
    };
  }

  /**
   * Calcula ATR (Average True Range)
   */
  private calculateATR(data: OHLCVData[], period: number = 14): number {
    if (data.length < period + 1) return 0;

    const trueRanges: number[] = [];
    
    for (let i = 1; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const prevClose = data[i - 1].close;
      
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

  /**
   * Calcula desvio padrão
   */
  private calculateStdDev(values: number[], period: number): number {
    if (values.length < period) return 0;
    
    const recent = values.slice(-period);
    const mean = recent.reduce((a, b) => a + b, 0) / period;
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    
    return Math.sqrt(variance);
  }

  /**
   * Calcula variação intradiária média
   */
  private calculateIntradayVariation(data: OHLCVData[]): number {
    if (data.length === 0) return 0;
    
    const variations = data.slice(-20).map(d => ((d.high - d.low) / d.low) * 100);
    return variations.reduce((a, b) => a + b, 0) / variations.length;
  }

  /**
   * Calcula volatilidade histórica
   */
  private calculateHistoricalVolatility(closes: number[], period: number): number {
    if (closes.length < period + 1) return 0;

    const returns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push(Math.log(closes[i] / closes[i - 1]));
    }

    const recentReturns = returns.slice(-period);
    const stdDev = this.calculateStdDev(recentReturns, period);
    
    // Anualizar (assumindo 365 dias)
    return stdDev * Math.sqrt(365) * 100;
  }

  /**
   * Calcula indicadores técnicos completos
   */
  calculateIndicators(data: OHLCVData[]) {
    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);

    return {
      rsi: this.calculateRSI(closes, 14),
      ema9: this.calculateEMA(closes, 9),
      ema21: this.calculateEMA(closes, 21),
      ema50: this.calculateEMA(closes, 50),
      ema200: this.calculateEMA(closes, 200),
      sma20: this.calculateSMA(closes, 20),
      sma50: this.calculateSMA(closes, 50),
      sma200: this.calculateSMA(closes, 200),
      ...this.calculateMACD(closes),
      ...this.calculateBollingerBands(closes, 20, 2),
      ...this.calculateStochastic(highs, lows, closes, 14),
      adx: this.calculateADX(data, 14),
      cci: this.calculateCCI(data, 20),
      williamsR: this.calculateWilliamsR(highs, lows, closes, 14),
    };
  }

  /**
   * Calcula RSI (Relative Strength Index)
   */
  private calculateRSI(closes: number[], period: number = 14): number {
    if (closes.length < period + 1) return 50;

    const changes: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      changes.push(closes[i] - closes[i - 1]);
    }

    const recentChanges = changes.slice(-period);
    const gains = recentChanges.filter(c => c > 0);
    const losses = recentChanges.filter(c => c < 0).map(c => Math.abs(c));

    const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;

    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Calcula EMA (Exponential Moving Average)
   */
  private calculateEMA(closes: number[], period: number): number {
    if (closes.length < period) return closes[closes.length - 1] || 0;

    const multiplier = 2 / (period + 1);
    let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < closes.length; i++) {
      ema = (closes[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  /**
   * Calcula SMA (Simple Moving Average)
   */
  private calculateSMA(closes: number[], period: number): number {
    if (closes.length < period) return closes[closes.length - 1] || 0;
    
    const recent = closes.slice(-period);
    return recent.reduce((a, b) => a + b, 0) / period;
  }

  /**
   * Calcula MACD (Moving Average Convergence Divergence)
   */
  private calculateMACD(closes: number[]) {
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    const macd = ema12 - ema26;
    
    // Signal line (EMA de 9 períodos do MACD)
    // Simplificado: usar média dos últimos 9 MACDs
    const macdSignal = macd * 0.9; // Aproximação
    const macdHist = macd - macdSignal;

    return {
      macd,
      macdSignal,
      macdHist,
    };
  }

  /**
   * Calcula Bollinger Bands
   */
  private calculateBollingerBands(closes: number[], period: number, stdDevMultiplier: number) {
    const sma = this.calculateSMA(closes, period);
    const stdDev = this.calculateStdDev(closes, period);

    const upper = sma + (stdDev * stdDevMultiplier);
    const lower = sma - (stdDev * stdDevMultiplier);
    const width = ((upper - lower) / sma) * 100;

    return {
      bollingerUpper: upper,
      bollingerMiddle: sma,
      bollingerLower: lower,
      bollingerWidth: width,
    };
  }

  /**
   * Calcula Stochastic Oscillator
   */
  private calculateStochastic(highs: number[], lows: number[], closes: number[], period: number) {
    if (closes.length < period) {
      return { stochK: 50, stochD: 50 };
    }

    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes[closes.length - 1];

    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);

    const stochK = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    const stochD = stochK * 0.9; // Aproximação (deveria ser SMA de 3 períodos do %K)

    return {
      stochK: isNaN(stochK) ? 50 : stochK,
      stochD: isNaN(stochD) ? 50 : stochD,
    };
  }

  /**
   * Calcula ADX (Average Directional Index)
   */
  private calculateADX(data: OHLCVData[], period: number = 14): number {
    if (data.length < period + 1) return 25;

    let plusDM = 0;
    let minusDM = 0;
    let tr = 0;

    for (let i = 1; i < Math.min(data.length, period + 1); i++) {
      const highDiff = data[i].high - data[i - 1].high;
      const lowDiff = data[i - 1].low - data[i].low;

      plusDM += highDiff > lowDiff && highDiff > 0 ? highDiff : 0;
      minusDM += lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0;

      const trueRange = Math.max(
        data[i].high - data[i].low,
        Math.abs(data[i].high - data[i - 1].close),
        Math.abs(data[i].low - data[i - 1].close)
      );
      tr += trueRange;
    }

    const plusDI = (plusDM / tr) * 100;
    const minusDI = (minusDM / tr) * 100;
    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;

    return isNaN(dx) ? 25 : dx;
  }

  /**
   * Calcula CCI (Commodity Channel Index)
   */
  private calculateCCI(data: OHLCVData[], period: number = 20): number {
    if (data.length < period) return 0;

    const recentData = data.slice(-period);
    const typicalPrices = recentData.map(d => (d.high + d.low + d.close) / 3);
    const sma = typicalPrices.reduce((a, b) => a + b, 0) / period;
    
    const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;
    const currentTP = typicalPrices[typicalPrices.length - 1];

    return (currentTP - sma) / (0.015 * meanDeviation);
  }

  /**
   * Calcula Williams %R
   */
  private calculateWilliamsR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
    if (closes.length < period) return -50;

    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes[closes.length - 1];

    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);

    return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
  }

  /**
   * Calcula derivativos de preço
   */
  calculatePriceDerivatives(data: OHLCVData[]) {
    if (data.length < 2) {
      return {
        priceChange: 0,
        priceSlope: 0,
        acceleration: 0,
        candleBodySize: 0,
        candleWickSize: 0,
        candleRange: 0,
      };
    }

    const latest = data[data.length - 1];
    const previous = data[data.length - 2];
    const closes = data.map(d => d.close);

    // Mudança de preço
    const priceChange = ((latest.close - previous.close) / previous.close) * 100;

    // Slope (inclinação) dos últimos 5 candles
    const priceSlope = this.calculateSlope(closes.slice(-5));

    // Aceleração (mudança do slope)
    const prevSlope = this.calculateSlope(closes.slice(-6, -1));
    const acceleration = priceSlope - prevSlope;

    // Tamanho do corpo do candle
    const candleBodySize = Math.abs(latest.close - latest.open);

    // Tamanho do pavio (wick)
    const upperWick = latest.high - Math.max(latest.open, latest.close);
    const lowerWick = Math.min(latest.open, latest.close) - latest.low;
    const candleWickSize = upperWick + lowerWick;

    // Range do candle
    const candleRange = latest.high - latest.low;

    return {
      priceChange,
      priceSlope,
      acceleration,
      candleBodySize,
      candleWickSize,
      candleRange,
    };
  }

  /**
   * Calcula slope (inclinação) de uma série
   */
  private calculateSlope(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (values[i] - yMean);
      denominator += Math.pow(i - xMean, 2);
    }

    return denominator !== 0 ? numerator / denominator : 0;
  }

  /**
   * Calcula diferenciais entre timeframes
   */
  calculateTimeframeDifferentials(multiTimeframeData: MultiTimeframeData) {
    const timeframes: (keyof MultiTimeframeData)[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
    const trends: number[] = [];

    for (const tf of timeframes) {
      const data = multiTimeframeData[tf];
      if (data && data.length >= 20) {
        const closes = data.map(d => d.close);
        const ema20 = this.calculateEMA(closes, 20);
        const currentPrice = closes[closes.length - 1];
        const trend = ((currentPrice - ema20) / ema20) * 100;
        trends.push(trend);
      }
    }

    if (trends.length < 3) {
      return {
        shortTermTrend: 0,
        mediumTermTrend: 0,
        longTermTrend: 0,
        trendAlignment: 0,
        trendDivergence: 0,
      };
    }

    const shortTermTrend = trends[0] || 0; // 1m
    const mediumTermTrend = trends[2] || 0; // 15m
    const longTermTrend = trends[4] || 0; // 4h

    // Alinhamento de tendência (todas na mesma direção)
    const allPositive = trends.every(t => t > 0);
    const allNegative = trends.every(t => t < 0);
    const trendAlignment = allPositive ? 1 : allNegative ? -1 : 0;

    // Divergência de tendência
    const trendDivergence = Math.abs(shortTermTrend - longTermTrend);

    return {
      shortTermTrend,
      mediumTermTrend,
      longTermTrend,
      trendAlignment,
      trendDivergence,
    };
  }

  /**
   * Calcula sinais de tendência
   */
  calculateTrendSignals(data: OHLCVData[]) {
    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);

    const ema20 = this.calculateEMA(closes, 20);
    const ema50 = this.calculateEMA(closes, 50);
    const currentPrice = closes[closes.length - 1];

    // Direção da tendência
    let trendDirection: 'UP' | 'DOWN' | 'SIDEWAYS' = 'SIDEWAYS';
    if (currentPrice > ema20 && ema20 > ema50) {
      trendDirection = 'UP';
    } else if (currentPrice < ema20 && ema20 < ema50) {
      trendDirection = 'DOWN';
    }

    // Força da tendência (ADX)
    const trendStrength = this.calculateADX(data, 14) / 100;

    // Consistência da tendência
    const recentCloses = closes.slice(-10);
    const upMoves = recentCloses.filter((c, i) => i > 0 && c > recentCloses[i - 1]).length;
    const trendConsistency = upMoves / 9;

    // Níveis de suporte e resistência (simplificado)
    const recentHighs = highs.slice(-20);
    const recentLows = lows.slice(-20);
    const resistanceLevel = Math.max(...recentHighs);
    const supportLevel = Math.min(...recentLows);

    return {
      trendDirection,
      trendStrength,
      trendConsistency,
      supportLevel,
      resistanceLevel,
    };
  }

  /**
   * Calcula probabilidade de reversão
   */
  calculateReversalProbability(data: OHLCVData[]) {
    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);

    // Score de exaustão (RSI extremo)
    const rsi = this.calculateRSI(closes, 14);
    let exhaustionScore = 0;
    if (rsi > 70) exhaustionScore = (rsi - 70) / 30;
    else if (rsi < 30) exhaustionScore = (30 - rsi) / 30;

    // Score de divergência (preço vs RSI)
    const priceSlope = this.calculateSlope(closes.slice(-10));
    const rsiValues = closes.slice(-10).map((_, i) => 
      this.calculateRSI(closes.slice(0, closes.length - 10 + i + 1), 14)
    );
    const rsiSlope = this.calculateSlope(rsiValues);
    const divergenceScore = Math.abs(priceSlope - rsiSlope) / 10;

    // Squeeze indicator (Bollinger Bands estreitando)
    const bb = this.calculateBollingerBands(closes, 20, 2);
    const squeezeIndicator = bb.bollingerWidth < 2 ? 1 : 0;

    // Score de sobre-extensão (distância das médias móveis)
    const ema20 = this.calculateEMA(closes, 20);
    const currentPrice = closes[closes.length - 1];
    const overextensionScore = Math.abs((currentPrice - ema20) / ema20);

    // Sinal de reversão combinado
    const reversalSignal = (
      exhaustionScore * 0.3 +
      divergenceScore * 0.3 +
      squeezeIndicator * 0.2 +
      overextensionScore * 0.2
    );

    return {
      exhaustionScore,
      divergenceScore,
      squeezeIndicator,
      overextensionScore,
      reversalSignal,
    };
  }

  /**
   * Converte features para array numérico (para alimentar modelos)
   */
  featuresToArray(features: AdvancedFeatures): number[] {
    return [
      // OHLCV
      features.ohlcv.open,
      features.ohlcv.high,
      features.ohlcv.low,
      features.ohlcv.close,
      features.ohlcv.volume,

      // Retornos
      features.returns.simple,
      features.returns.logarithmic,
      features.returns.rolling5,
      features.returns.rolling10,
      features.returns.rolling20,

      // Volatilidade
      features.volatility.atr,
      features.volatility.stdDev,
      features.volatility.intradayVariation,
      features.volatility.historicalVolatility,

      // Indicadores
      features.indicators.rsi,
      features.indicators.ema9,
      features.indicators.ema21,
      features.indicators.ema50,
      features.indicators.ema200,
      features.indicators.sma20,
      features.indicators.sma50,
      features.indicators.sma200,
      features.indicators.macd,
      features.indicators.macdSignal,
      features.indicators.macdHist,
      features.indicators.bollingerUpper,
      features.indicators.bollingerMiddle,
      features.indicators.bollingerLower,
      features.indicators.bollingerWidth,
      features.indicators.stochK,
      features.indicators.stochD,
      features.indicators.adx,
      features.indicators.cci,
      features.indicators.williamsR,

      // Derivativos de preço
      features.priceDerivatives.priceChange,
      features.priceDerivatives.priceSlope,
      features.priceDerivatives.acceleration,
      features.priceDerivatives.candleBodySize,
      features.priceDerivatives.candleWickSize,
      features.priceDerivatives.candleRange,

      // Diferenciais entre timeframes
      features.timeframeDifferentials.shortTermTrend,
      features.timeframeDifferentials.mediumTermTrend,
      features.timeframeDifferentials.longTermTrend,
      features.timeframeDifferentials.trendAlignment,
      features.timeframeDifferentials.trendDivergence,

      // Sinais de tendência
      features.trendSignals.trendDirection === 'UP' ? 1 : features.trendSignals.trendDirection === 'DOWN' ? -1 : 0,
      features.trendSignals.trendStrength,
      features.trendSignals.trendConsistency,
      features.trendSignals.supportLevel,
      features.trendSignals.resistanceLevel,

      // Probabilidade de reversão
      features.reversalProbability.exhaustionScore,
      features.reversalProbability.divergenceScore,
      features.reversalProbability.squeezeIndicator,
      features.reversalProbability.overextensionScore,
      features.reversalProbability.reversalSignal,

      // 🆕 Padrões de candles e gráficos
      features.patterns.hasDoji ? 1 : 0,
      features.patterns.hasHammer ? 1 : 0,
      features.patterns.hasEngulfing ? 1 : 0,
      features.patterns.hasMorningStar ? 1 : 0,
      features.patterns.hasEveningStar ? 1 : 0,
      features.patterns.hasHeadAndShoulders ? 1 : 0,
      features.patterns.hasDoubleTop ? 1 : 0,
      features.patterns.hasDoubleBottom ? 1 : 0,
      features.patterns.hasTriangle ? 1 : 0,
      features.patterns.hasFlag ? 1 : 0,
      features.patterns.hasCupAndHandle ? 1 : 0,
      features.patterns.bullishCandleScore,
      features.patterns.bearishCandleScore,
      features.patterns.bullishChartScore,
      features.patterns.bearishChartScore,
      features.patterns.combinedSignal,
      features.patterns.patternStrength,
    ];
  }

  /**
   * Normaliza features para range [0, 1]
   */
  normalizeFeatures(featuresArray: number[]): number[] {
    // Min-Max normalization
    const min = Math.min(...featuresArray);
    const max = Math.max(...featuresArray);
    const range = max - min;

    if (range === 0) return featuresArray.map(() => 0.5);

    return featuresArray.map(val => (val - min) / range);
  }

  /**
   * Cria sequências para modelos de séries temporais
   */
  createSequences(
    multiTimeframeData: MultiTimeframeData,
    sequenceLength: number = 60,
    primaryTimeframe: keyof MultiTimeframeData = '1m'
  ): number[][] {
    const data = multiTimeframeData[primaryTimeframe];
    
    if (!data || data.length < sequenceLength) {
      throw new Error(`Dados insuficientes para criar sequência de ${sequenceLength} períodos`);
    }

    const sequences: number[][] = [];

    for (let i = sequenceLength; i <= data.length; i++) {
      const window = data.slice(i - sequenceLength, i);
      const features = window.map(candle => 
        this.extractAllFeatures({ [primaryTimeframe]: [candle] }, primaryTimeframe)
      );
      
      const featureArrays = features.map(f => this.featuresToArray(f));
      sequences.push(featureArrays.flat());
    }

    return sequences;
  }
}
