/**
 * Detecção de Padrões de Candles Simples
 * Implementa regras programadas para identificar padrões clássicos
 */

import {
  OHLCVData,
  CandlePatternType,
  CandlePatternResult,
  PatternDirection,
  PatternReliability,
} from './types';

export class CandlePatternDetector {
  private readonly BODY_THRESHOLD = 0.1; // 10% do range
  private readonly WICK_THRESHOLD = 0.6; // 60% do range
  private readonly DOJI_THRESHOLD = 0.05; // 5% do range

  /**
   * Detecta todos os padrões de candles em uma série de dados
   */
  detectPatterns(data: OHLCVData[], lookback: number = 3): CandlePatternResult[] {
    const patterns: CandlePatternResult[] = [];

    if (data.length < lookback) {
      return patterns;
    }

    // Detectar padrões de 1 candle
    const singleCandlePatterns = this.detectSingleCandlePatterns(data);
    patterns.push(...singleCandlePatterns);

    // Detectar padrões de 2 candles
    if (data.length >= 2) {
      const doubleCandlePatterns = this.detectDoubleCandlePatterns(data);
      patterns.push(...doubleCandlePatterns);
    }

    // Detectar padrões de 3 candles
    if (data.length >= 3) {
      const tripleCandlePatterns = this.detectTripleCandlePatterns(data);
      patterns.push(...tripleCandlePatterns);
    }

    return patterns;
  }

  /**
   * Detecta padrões de 1 candle
   */
  private detectSingleCandlePatterns(data: OHLCVData[]): CandlePatternResult[] {
    const patterns: CandlePatternResult[] = [];
    const candle = data[data.length - 1];
    const index = data.length - 1;

    // Doji
    const dojiPattern = this.detectDoji(candle, index);
    if (dojiPattern) patterns.push(dojiPattern);

    // Marubozu
    const marubozuPattern = this.detectMarubozu(candle, index);
    if (marubozuPattern) patterns.push(marubozuPattern);

    // Hammer / Hanging Man
    const hammerPattern = this.detectHammer(candle, data, index);
    if (hammerPattern) patterns.push(hammerPattern);

    // Inverted Hammer / Shooting Star
    const invertedHammerPattern = this.detectInvertedHammer(candle, data, index);
    if (invertedHammerPattern) patterns.push(invertedHammerPattern);

    return patterns;
  }

  /**
   * Detecta padrões de 2 candles
   */
  private detectDoubleCandlePatterns(data: OHLCVData[]): CandlePatternResult[] {
    const patterns: CandlePatternResult[] = [];
    const current = data[data.length - 1];
    const previous = data[data.length - 2];
    const index = data.length - 1;

    // Engulfing
    const engulfingPattern = this.detectEngulfing(previous, current, index);
    if (engulfingPattern) patterns.push(engulfingPattern);

    // Harami
    const haramiPattern = this.detectHarami(previous, current, index);
    if (haramiPattern) patterns.push(haramiPattern);

    // Piercing Line / Dark Cloud Cover
    const piercingPattern = this.detectPiercingLine(previous, current, index);
    if (piercingPattern) patterns.push(piercingPattern);

    // Tweezer
    const tweezerPattern = this.detectTweezer(previous, current, index);
    if (tweezerPattern) patterns.push(tweezerPattern);

    return patterns;
  }

  /**
   * Detecta padrões de 3 candles
   */
  private detectTripleCandlePatterns(data: OHLCVData[]): CandlePatternResult[] {
    const patterns: CandlePatternResult[] = [];
    const third = data[data.length - 1];
    const second = data[data.length - 2];
    const first = data[data.length - 3];
    const index = data.length - 1;

    // Morning Star / Evening Star
    const starPattern = this.detectStar(first, second, third, index);
    if (starPattern) patterns.push(starPattern);

    // Three White Soldiers / Three Black Crows
    const soldiersPattern = this.detectThreeSoldiers(first, second, third, index);
    if (soldiersPattern) patterns.push(soldiersPattern);

    return patterns;
  }

  /**
   * Detecta Doji
   */
  private detectDoji(candle: OHLCVData, index: number): CandlePatternResult | null {
    const body = Math.abs(candle.close - candle.open);
    const range = candle.high - candle.low;

    if (range === 0) return null;

    const bodyRatio = body / range;

    if (bodyRatio < this.DOJI_THRESHOLD) {
      return {
        type: 'DOJI',
        direction: 'NEUTRAL',
        confidence: 1 - bodyRatio / this.DOJI_THRESHOLD,
        reliability: 'MEDIUM',
        description: 'Doji - Indecisão do mercado, possível reversão',
        timestamp: candle.timestamp,
        candleIndex: index,
      };
    }

    return null;
  }

  /**
   * Detecta Marubozu
   */
  private detectMarubozu(candle: OHLCVData, index: number): CandlePatternResult | null {
    const body = Math.abs(candle.close - candle.open);
    const range = candle.high - candle.low;

    if (range === 0) return null;

    const bodyRatio = body / range;
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const wickRatio = (upperWick + lowerWick) / range;

    if (bodyRatio > 0.9 && wickRatio < 0.1) {
      const isBullish = candle.close > candle.open;

      return {
        type: isBullish ? 'MARUBOZU_BULLISH' : 'MARUBOZU_BEARISH',
        direction: isBullish ? 'BULLISH' : 'BEARISH',
        confidence: bodyRatio,
        reliability: 'HIGH',
        description: `Marubozu ${isBullish ? 'Bullish' : 'Bearish'} - Forte pressão ${isBullish ? 'compradora' : 'vendedora'}`,
        timestamp: candle.timestamp,
        candleIndex: index,
      };
    }

    return null;
  }

  /**
   * Detecta Hammer / Hanging Man
   */
  private detectHammer(candle: OHLCVData, data: OHLCVData[], index: number): CandlePatternResult | null {
    const body = Math.abs(candle.close - candle.open);
    const range = candle.high - candle.low;
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const upperWick = candle.high - Math.max(candle.open, candle.close);

    if (range === 0) return null;

    const lowerWickRatio = lowerWick / range;
    const bodyRatio = body / range;

    // Hammer: corpo pequeno, pavio inferior longo
    if (lowerWickRatio > this.WICK_THRESHOLD && bodyRatio < 0.3 && upperWick < body) {
      // Determinar se é Hammer (bullish) ou Hanging Man (bearish) baseado na tendência
      const isDowntrend = this.isInDowntrend(data, index);
      const isHammer = isDowntrend;

      return {
        type: isHammer ? 'HAMMER' : 'HANGING_MAN',
        direction: isHammer ? 'BULLISH' : 'BEARISH',
        confidence: lowerWickRatio,
        reliability: 'HIGH',
        description: isHammer 
          ? 'Hammer - Possível reversão de alta após downtrend'
          : 'Hanging Man - Possível reversão de baixa após uptrend',
        timestamp: candle.timestamp,
        candleIndex: index,
      };
    }

    return null;
  }

  /**
   * Detecta Inverted Hammer / Shooting Star
   */
  private detectInvertedHammer(candle: OHLCVData, data: OHLCVData[], index: number): CandlePatternResult | null {
    const body = Math.abs(candle.close - candle.open);
    const range = candle.high - candle.low;
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;

    if (range === 0) return null;

    const upperWickRatio = upperWick / range;
    const bodyRatio = body / range;

    // Inverted Hammer: corpo pequeno, pavio superior longo
    if (upperWickRatio > this.WICK_THRESHOLD && bodyRatio < 0.3 && lowerWick < body) {
      const isDowntrend = this.isInDowntrend(data, index);
      const isInvertedHammer = isDowntrend;

      return {
        type: isInvertedHammer ? 'INVERTED_HAMMER' : 'SHOOTING_STAR',
        direction: isInvertedHammer ? 'BULLISH' : 'BEARISH',
        confidence: upperWickRatio,
        reliability: 'MEDIUM',
        description: isInvertedHammer
          ? 'Inverted Hammer - Possível reversão de alta'
          : 'Shooting Star - Possível reversão de baixa',
        timestamp: candle.timestamp,
        candleIndex: index,
      };
    }

    return null;
  }

  /**
   * Detecta Engulfing
   */
  private detectEngulfing(prev: OHLCVData, curr: OHLCVData, index: number): CandlePatternResult | null {
    const prevBody = Math.abs(prev.close - prev.open);
    const currBody = Math.abs(curr.close - curr.open);

    const prevIsBullish = prev.close > prev.open;
    const currIsBullish = curr.close > curr.open;

    // Bullish Engulfing
    if (!prevIsBullish && currIsBullish && curr.open < prev.close && curr.close > prev.open) {
      const engulfRatio = currBody / prevBody;

      return {
        type: 'ENGULFING_BULLISH',
        direction: 'BULLISH',
        confidence: Math.min(engulfRatio / 1.5, 1),
        reliability: 'HIGH',
        description: 'Bullish Engulfing - Forte sinal de reversão de alta',
        timestamp: curr.timestamp,
        candleIndex: index,
      };
    }

    // Bearish Engulfing
    if (prevIsBullish && !currIsBullish && curr.open > prev.close && curr.close < prev.open) {
      const engulfRatio = currBody / prevBody;

      return {
        type: 'ENGULFING_BEARISH',
        direction: 'BEARISH',
        confidence: Math.min(engulfRatio / 1.5, 1),
        reliability: 'HIGH',
        description: 'Bearish Engulfing - Forte sinal de reversão de baixa',
        timestamp: curr.timestamp,
        candleIndex: index,
      };
    }

    return null;
  }

  /**
   * Detecta Harami
   */
  private detectHarami(prev: OHLCVData, curr: OHLCVData, index: number): CandlePatternResult | null {
    const prevBody = Math.abs(prev.close - prev.open);
    const currBody = Math.abs(curr.close - curr.open);

    const prevIsBullish = prev.close > prev.open;
    const currIsBullish = curr.close > curr.open;

    const prevBodyTop = Math.max(prev.open, prev.close);
    const prevBodyBottom = Math.min(prev.open, prev.close);
    const currBodyTop = Math.max(curr.open, curr.close);
    const currBodyBottom = Math.min(curr.open, curr.close);

    // Corpo atual está contido no corpo anterior
    if (currBodyTop < prevBodyTop && currBodyBottom > prevBodyBottom && currBody < prevBody * 0.5) {
      // Bullish Harami
      if (!prevIsBullish && currIsBullish) {
        return {
          type: 'HARAMI_BULLISH',
          direction: 'BULLISH',
          confidence: 1 - (currBody / prevBody),
          reliability: 'MEDIUM',
          description: 'Bullish Harami - Possível reversão de alta',
          timestamp: curr.timestamp,
          candleIndex: index,
        };
      }

      // Bearish Harami
      if (prevIsBullish && !currIsBullish) {
        return {
          type: 'HARAMI_BEARISH',
          direction: 'BEARISH',
          confidence: 1 - (currBody / prevBody),
          reliability: 'MEDIUM',
          description: 'Bearish Harami - Possível reversão de baixa',
          timestamp: curr.timestamp,
          candleIndex: index,
        };
      }
    }

    return null;
  }

  /**
   * Detecta Piercing Line / Dark Cloud Cover
   */
  private detectPiercingLine(prev: OHLCVData, curr: OHLCVData, index: number): CandlePatternResult | null {
    const prevIsBullish = prev.close > prev.open;
    const currIsBullish = curr.close > curr.open;
    const prevMidpoint = (prev.open + prev.close) / 2;

    // Piercing Line (bullish)
    if (!prevIsBullish && currIsBullish && curr.open < prev.low && curr.close > prevMidpoint && curr.close < prev.open) {
      const penetration = (curr.close - prev.close) / (prev.open - prev.close);

      return {
        type: 'PIERCING_LINE',
        direction: 'BULLISH',
        confidence: penetration,
        reliability: 'MEDIUM',
        description: 'Piercing Line - Sinal de reversão de alta',
        timestamp: curr.timestamp,
        candleIndex: index,
      };
    }

    // Dark Cloud Cover (bearish)
    if (prevIsBullish && !currIsBullish && curr.open > prev.high && curr.close < prevMidpoint && curr.close > prev.open) {
      const penetration = (prev.close - curr.close) / (prev.close - prev.open);

      return {
        type: 'DARK_CLOUD_COVER',
        direction: 'BEARISH',
        confidence: penetration,
        reliability: 'MEDIUM',
        description: 'Dark Cloud Cover - Sinal de reversão de baixa',
        timestamp: curr.timestamp,
        candleIndex: index,
      };
    }

    return null;
  }

  /**
   * Detecta Tweezer Top / Bottom
   */
  private detectTweezer(prev: OHLCVData, curr: OHLCVData, index: number): CandlePatternResult | null {
    const tolerance = (prev.high - prev.low) * 0.02; // 2% de tolerância

    // Tweezer Top
    if (Math.abs(prev.high - curr.high) < tolerance && prev.close > prev.open && curr.close < curr.open) {
      return {
        type: 'TWEEZER_TOP',
        direction: 'BEARISH',
        confidence: 0.7,
        reliability: 'MEDIUM',
        description: 'Tweezer Top - Possível reversão de baixa',
        timestamp: curr.timestamp,
        candleIndex: index,
      };
    }

    // Tweezer Bottom
    if (Math.abs(prev.low - curr.low) < tolerance && prev.close < prev.open && curr.close > curr.open) {
      return {
        type: 'TWEEZER_BOTTOM',
        direction: 'BULLISH',
        confidence: 0.7,
        reliability: 'MEDIUM',
        description: 'Tweezer Bottom - Possível reversão de alta',
        timestamp: curr.timestamp,
        candleIndex: index,
      };
    }

    return null;
  }

  /**
   * Detecta Morning Star / Evening Star
   */
  private detectStar(first: OHLCVData, second: OHLCVData, third: OHLCVData, index: number): CandlePatternResult | null {
    const firstBody = Math.abs(first.close - first.open);
    const secondBody = Math.abs(second.close - second.open);
    const thirdBody = Math.abs(third.close - third.open);

    const firstIsBullish = first.close > first.open;
    const thirdIsBullish = third.close > third.open;

    // Morning Star (bullish)
    if (!firstIsBullish && thirdIsBullish && secondBody < firstBody * 0.3 && thirdBody > firstBody * 0.5) {
      const gap1 = second.high < first.close;
      const gap2 = third.open > second.high;

      return {
        type: 'MORNING_STAR',
        direction: 'BULLISH',
        confidence: (gap1 && gap2) ? 0.9 : 0.7,
        reliability: 'HIGH',
        description: 'Morning Star - Forte sinal de reversão de alta',
        timestamp: third.timestamp,
        candleIndex: index,
      };
    }

    // Evening Star (bearish)
    if (firstIsBullish && !thirdIsBullish && secondBody < firstBody * 0.3 && thirdBody > firstBody * 0.5) {
      const gap1 = second.low > first.close;
      const gap2 = third.open < second.low;

      return {
        type: 'EVENING_STAR',
        direction: 'BEARISH',
        confidence: (gap1 && gap2) ? 0.9 : 0.7,
        reliability: 'HIGH',
        description: 'Evening Star - Forte sinal de reversão de baixa',
        timestamp: third.timestamp,
        candleIndex: index,
      };
    }

    return null;
  }

  /**
   * Detecta Three White Soldiers / Three Black Crows
   */
  private detectThreeSoldiers(first: OHLCVData, second: OHLCVData, third: OHLCVData, index: number): CandlePatternResult | null {
    const firstIsBullish = first.close > first.open;
    const secondIsBullish = second.close > second.open;
    const thirdIsBullish = third.close > third.open;

    // Three White Soldiers (bullish)
    if (firstIsBullish && secondIsBullish && thirdIsBullish) {
      const consecutive = second.open > first.open && second.close > first.close &&
                         third.open > second.open && third.close > second.close;

      if (consecutive) {
        return {
          type: 'THREE_WHITE_SOLDIERS',
          direction: 'BULLISH',
          confidence: 0.85,
          reliability: 'HIGH',
          description: 'Three White Soldiers - Forte tendência de alta',
          timestamp: third.timestamp,
          candleIndex: index,
        };
      }
    }

    // Three Black Crows (bearish)
    if (!firstIsBullish && !secondIsBullish && !thirdIsBullish) {
      const consecutive = second.open < first.open && second.close < first.close &&
                         third.open < second.open && third.close < second.close;

      if (consecutive) {
        return {
          type: 'THREE_BLACK_CROWS',
          direction: 'BEARISH',
          confidence: 0.85,
          reliability: 'HIGH',
          description: 'Three Black Crows - Forte tendência de baixa',
          timestamp: third.timestamp,
          candleIndex: index,
        };
      }
    }

    return null;
  }

  /**
   * Verifica se está em downtrend
   */
  private isInDowntrend(data: OHLCVData[], currentIndex: number): boolean {
    if (currentIndex < 5) return false;

    const recentCandles = data.slice(currentIndex - 5, currentIndex);
    const closes = recentCandles.map(c => c.close);

    // Verificar se a maioria dos closes está decrescendo
    let downMoves = 0;
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] < closes[i - 1]) downMoves++;
    }

    return downMoves >= 3;
  }
}
