/**
 * Detecção de Padrões Gráficos Complexos
 * Implementa regras programadas para identificar padrões de preço
 */

import {
  OHLCVData,
  ChartPatternType,
  ChartPatternResult,
  PatternDirection,
  PatternReliability,
} from './types';

interface Peak {
  index: number;
  price: number;
  type: 'HIGH' | 'LOW';
}

export class ChartPatternDetector {
  private readonly MIN_PATTERN_LENGTH = 20;
  private readonly TOLERANCE = 0.02; // 2% de tolerância para níveis

  /**
   * Detecta todos os padrões gráficos em uma série de dados
   */
  detectPatterns(data: OHLCVData[], lookback: number = 100): ChartPatternResult[] {
    const patterns: ChartPatternResult[] = [];

    if (data.length < this.MIN_PATTERN_LENGTH) {
      return patterns;
    }

    const recentData = data.slice(-lookback);

    // Identificar picos e vales
    const peaks = this.findPeaksAndValleys(recentData);

    // Detectar padrões de reversão
    const headAndShoulders = this.detectHeadAndShoulders(recentData, peaks);
    if (headAndShoulders) patterns.push(headAndShoulders);

    const doubleTop = this.detectDoubleTop(recentData, peaks);
    if (doubleTop) patterns.push(doubleTop);

    const doubleBottom = this.detectDoubleBottom(recentData, peaks);
    if (doubleBottom) patterns.push(doubleBottom);

    const tripleTop = this.detectTripleTop(recentData, peaks);
    if (tripleTop) patterns.push(tripleTop);

    const tripleBottom = this.detectTripleBottom(recentData, peaks);
    if (tripleBottom) patterns.push(tripleBottom);

    // Detectar padrões de continuação
    const triangle = this.detectTriangle(recentData);
    if (triangle) patterns.push(triangle);

    const flag = this.detectFlag(recentData);
    if (flag) patterns.push(flag);

    const pennant = this.detectPennant(recentData);
    if (pennant) patterns.push(pennant);

    const wedge = this.detectWedge(recentData);
    if (wedge) patterns.push(wedge);

    // Detectar canais
    const channel = this.detectChannel(recentData);
    if (channel) patterns.push(channel);

    // Detectar padrões especiais
    const cupAndHandle = this.detectCupAndHandle(recentData);
    if (cupAndHandle) patterns.push(cupAndHandle);

    const roundingBottom = this.detectRoundingBottom(recentData);
    if (roundingBottom) patterns.push(roundingBottom);

    return patterns;
  }

  /**
   * Encontra picos (topos) e vales (fundos)
   */
  private findPeaksAndValleys(data: OHLCVData[], window: number = 5): Peak[] {
    const peaks: Peak[] = [];

    for (let i = window; i < data.length - window; i++) {
      const current = data[i];
      const leftWindow = data.slice(i - window, i);
      const rightWindow = data.slice(i + 1, i + window + 1);

      // Verificar se é um pico (topo)
      const isHigh = leftWindow.every(c => c.high <= current.high) &&
                     rightWindow.every(c => c.high <= current.high);

      if (isHigh) {
        peaks.push({ index: i, price: current.high, type: 'HIGH' });
      }

      // Verificar se é um vale (fundo)
      const isLow = leftWindow.every(c => c.low >= current.low) &&
                    rightWindow.every(c => c.low >= current.low);

      if (isLow) {
        peaks.push({ index: i, price: current.low, type: 'LOW' });
      }
    }

    return peaks;
  }

  /**
   * Detecta Head and Shoulders / Inverse Head and Shoulders
   */
  private detectHeadAndShoulders(data: OHLCVData[], peaks: Peak[]): ChartPatternResult | null {
    const highs = peaks.filter(p => p.type === 'HIGH');
    const lows = peaks.filter(p => p.type === 'LOW');

    if (highs.length < 3) return null;

    // Procurar por 3 topos consecutivos onde o do meio é o mais alto
    for (let i = 0; i < highs.length - 2; i++) {
      const leftShoulder = highs[i];
      const head = highs[i + 1];
      const rightShoulder = highs[i + 2];

      // Verificar se forma ombro-cabeça-ombro
      const isPattern = head.price > leftShoulder.price * 1.02 &&
                       head.price > rightShoulder.price * 1.02 &&
                       Math.abs(leftShoulder.price - rightShoulder.price) / leftShoulder.price < this.TOLERANCE;

      if (isPattern) {
        // Encontrar neckline (linha do pescoço)
        const necklineLows = lows.filter(l => l.index > leftShoulder.index && l.index < rightShoulder.index);
        const neckline = necklineLows.length > 0 
          ? Math.max(...necklineLows.map(l => l.price))
          : (leftShoulder.price + rightShoulder.price) / 2;

        const target = neckline - (head.price - neckline);

        return {
          type: 'HEAD_AND_SHOULDERS',
          direction: 'BEARISH',
          confidence: 0.8,
          reliability: 'HIGH',
          description: 'Head and Shoulders - Forte padrão de reversão de baixa',
          timestamp: data[data.length - 1].timestamp,
          startIndex: leftShoulder.index,
          endIndex: rightShoulder.index,
          keyLevels: {
            resistance: head.price,
            neckline,
            target,
          },
        };
      }
    }

    // Procurar por Inverse Head and Shoulders (fundos)
    if (lows.length < 3) return null;

    for (let i = 0; i < lows.length - 2; i++) {
      const leftShoulder = lows[i];
      const head = lows[i + 1];
      const rightShoulder = lows[i + 2];

      const isPattern = head.price < leftShoulder.price * 0.98 &&
                       head.price < rightShoulder.price * 0.98 &&
                       Math.abs(leftShoulder.price - rightShoulder.price) / leftShoulder.price < this.TOLERANCE;

      if (isPattern) {
        const necklineHighs = highs.filter(h => h.index > leftShoulder.index && h.index < rightShoulder.index);
        const neckline = necklineHighs.length > 0
          ? Math.min(...necklineHighs.map(h => h.price))
          : (leftShoulder.price + rightShoulder.price) / 2;

        const target = neckline + (neckline - head.price);

        return {
          type: 'INVERSE_HEAD_AND_SHOULDERS',
          direction: 'BULLISH',
          confidence: 0.8,
          reliability: 'HIGH',
          description: 'Inverse Head and Shoulders - Forte padrão de reversão de alta',
          timestamp: data[data.length - 1].timestamp,
          startIndex: leftShoulder.index,
          endIndex: rightShoulder.index,
          keyLevels: {
            support: head.price,
            neckline,
            target,
          },
        };
      }
    }

    return null;
  }

  /**
   * Detecta Double Top
   */
  private detectDoubleTop(data: OHLCVData[], peaks: Peak[]): ChartPatternResult | null {
    const highs = peaks.filter(p => p.type === 'HIGH');

    if (highs.length < 2) return null;

    for (let i = 0; i < highs.length - 1; i++) {
      const first = highs[i];
      const second = highs[i + 1];

      const priceDiff = Math.abs(first.price - second.price) / first.price;
      const timeDiff = second.index - first.index;

      if (priceDiff < this.TOLERANCE && timeDiff > 10 && timeDiff < 50) {
        const support = Math.min(...data.slice(first.index, second.index + 1).map(c => c.low));
        const target = support - (first.price - support);

        return {
          type: 'DOUBLE_TOP',
          direction: 'BEARISH',
          confidence: 0.75,
          reliability: 'HIGH',
          description: 'Double Top - Padrão de reversão de baixa',
          timestamp: data[data.length - 1].timestamp,
          startIndex: first.index,
          endIndex: second.index,
          keyLevels: {
            resistance: (first.price + second.price) / 2,
            support,
            target,
          },
        };
      }
    }

    return null;
  }

  /**
   * Detecta Double Bottom
   */
  private detectDoubleBottom(data: OHLCVData[], peaks: Peak[]): ChartPatternResult | null {
    const lows = peaks.filter(p => p.type === 'LOW');

    if (lows.length < 2) return null;

    for (let i = 0; i < lows.length - 1; i++) {
      const first = lows[i];
      const second = lows[i + 1];

      const priceDiff = Math.abs(first.price - second.price) / first.price;
      const timeDiff = second.index - first.index;

      if (priceDiff < this.TOLERANCE && timeDiff > 10 && timeDiff < 50) {
        const resistance = Math.max(...data.slice(first.index, second.index + 1).map(c => c.high));
        const target = resistance + (resistance - first.price);

        return {
          type: 'DOUBLE_BOTTOM',
          direction: 'BULLISH',
          confidence: 0.75,
          reliability: 'HIGH',
          description: 'Double Bottom - Padrão de reversão de alta',
          timestamp: data[data.length - 1].timestamp,
          startIndex: first.index,
          endIndex: second.index,
          keyLevels: {
            support: (first.price + second.price) / 2,
            resistance,
            target,
          },
        };
      }
    }

    return null;
  }

  /**
   * Detecta Triple Top
   */
  private detectTripleTop(data: OHLCVData[], peaks: Peak[]): ChartPatternResult | null {
    const highs = peaks.filter(p => p.type === 'HIGH');

    if (highs.length < 3) return null;

    for (let i = 0; i < highs.length - 2; i++) {
      const first = highs[i];
      const second = highs[i + 1];
      const third = highs[i + 2];

      const avgPrice = (first.price + second.price + third.price) / 3;
      const maxDiff = Math.max(
        Math.abs(first.price - avgPrice),
        Math.abs(second.price - avgPrice),
        Math.abs(third.price - avgPrice)
      ) / avgPrice;

      if (maxDiff < this.TOLERANCE) {
        const support = Math.min(...data.slice(first.index, third.index + 1).map(c => c.low));
        const target = support - (avgPrice - support);

        return {
          type: 'TRIPLE_TOP',
          direction: 'BEARISH',
          confidence: 0.8,
          reliability: 'HIGH',
          description: 'Triple Top - Forte padrão de reversão de baixa',
          timestamp: data[data.length - 1].timestamp,
          startIndex: first.index,
          endIndex: third.index,
          keyLevels: {
            resistance: avgPrice,
            support,
            target,
          },
        };
      }
    }

    return null;
  }

  /**
   * Detecta Triple Bottom
   */
  private detectTripleBottom(data: OHLCVData[], peaks: Peak[]): ChartPatternResult | null {
    const lows = peaks.filter(p => p.type === 'LOW');

    if (lows.length < 3) return null;

    for (let i = 0; i < lows.length - 2; i++) {
      const first = lows[i];
      const second = lows[i + 1];
      const third = lows[i + 2];

      const avgPrice = (first.price + second.price + third.price) / 3;
      const maxDiff = Math.max(
        Math.abs(first.price - avgPrice),
        Math.abs(second.price - avgPrice),
        Math.abs(third.price - avgPrice)
      ) / avgPrice;

      if (maxDiff < this.TOLERANCE) {
        const resistance = Math.max(...data.slice(first.index, third.index + 1).map(c => c.high));
        const target = resistance + (resistance - avgPrice);

        return {
          type: 'TRIPLE_BOTTOM',
          direction: 'BULLISH',
          confidence: 0.8,
          reliability: 'HIGH',
          description: 'Triple Bottom - Forte padrão de reversão de alta',
          timestamp: data[data.length - 1].timestamp,
          startIndex: first.index,
          endIndex: third.index,
          keyLevels: {
            support: avgPrice,
            resistance,
            target,
          },
        };
      }
    }

    return null;
  }

  /**
   * Detecta Triângulos (Ascending, Descending, Symmetrical)
   */
  private detectTriangle(data: OHLCVData[]): ChartPatternResult | null {
    if (data.length < 30) return null;

    const recentData = data.slice(-50);
    const highs = recentData.map(c => c.high);
    const lows = recentData.map(c => c.low);

    // Calcular tendências das máximas e mínimas
    const highTrend = this.calculateTrend(highs);
    const lowTrend = this.calculateTrend(lows);

    const startIndex = data.length - 50;
    const endIndex = data.length - 1;

    // Triângulo Ascendente (highs flat, lows rising)
    if (Math.abs(highTrend) < 0.0005 && lowTrend > 0.001) {
      const resistance = Math.max(...highs);
      const support = lows[lows.length - 1];

      return {
        type: 'TRIANGLE_ASCENDING',
        direction: 'BULLISH',
        confidence: 0.7,
        reliability: 'MEDIUM',
        description: 'Triângulo Ascendente - Padrão de continuação de alta',
        timestamp: data[data.length - 1].timestamp,
        startIndex,
        endIndex,
        keyLevels: {
          resistance,
          support,
          target: resistance + (resistance - support),
        },
      };
    }

    // Triângulo Descendente (lows flat, highs falling)
    if (Math.abs(lowTrend) < 0.0005 && highTrend < -0.001) {
      const support = Math.min(...lows);
      const resistance = highs[highs.length - 1];

      return {
        type: 'TRIANGLE_DESCENDING',
        direction: 'BEARISH',
        confidence: 0.7,
        reliability: 'MEDIUM',
        description: 'Triângulo Descendente - Padrão de continuação de baixa',
        timestamp: data[data.length - 1].timestamp,
        startIndex,
        endIndex,
        keyLevels: {
          resistance,
          support,
          target: support - (resistance - support),
        },
      };
    }

    // Triângulo Simétrico (highs falling, lows rising)
    if (highTrend < -0.0005 && lowTrend > 0.0005) {
      const resistance = highs[0];
      const support = lows[0];

      return {
        type: 'TRIANGLE_SYMMETRICAL',
        direction: 'NEUTRAL',
        confidence: 0.65,
        reliability: 'MEDIUM',
        description: 'Triângulo Simétrico - Padrão de consolidação',
        timestamp: data[data.length - 1].timestamp,
        startIndex,
        endIndex,
        keyLevels: {
          resistance,
          support,
        },
      };
    }

    return null;
  }

  /**
   * Detecta Flag (Bullish/Bearish)
   */
  private detectFlag(data: OHLCVData[]): ChartPatternResult | null {
    if (data.length < 30) return null;

    // Verificar movimento forte (flagpole)
    const poleStart = data.length - 30;
    const poleEnd = data.length - 10;
    const flagStart = poleEnd;
    const flagEnd = data.length - 1;

    const poleData = data.slice(poleStart, poleEnd);
    const flagData = data.slice(flagStart, flagEnd);

    const poleMove = (poleData[poleData.length - 1].close - poleData[0].close) / poleData[0].close;
    const flagMove = (flagData[flagData.length - 1].close - flagData[0].close) / flagData[0].close;

    // Bullish Flag (pole up, flag slightly down)
    if (poleMove > 0.05 && flagMove < 0 && Math.abs(flagMove) < 0.03) {
      return {
        type: 'FLAG_BULLISH',
        direction: 'BULLISH',
        confidence: 0.7,
        reliability: 'MEDIUM',
        description: 'Bullish Flag - Padrão de continuação de alta',
        timestamp: data[data.length - 1].timestamp,
        startIndex: poleStart,
        endIndex: flagEnd,
        keyLevels: {
          support: Math.min(...flagData.map(c => c.low)),
          target: data[flagEnd].close + (poleData[poleEnd - 1].close - poleData[0].close),
        },
      };
    }

    // Bearish Flag (pole down, flag slightly up)
    if (poleMove < -0.05 && flagMove > 0 && Math.abs(flagMove) < 0.03) {
      return {
        type: 'FLAG_BEARISH',
        direction: 'BEARISH',
        confidence: 0.7,
        reliability: 'MEDIUM',
        description: 'Bearish Flag - Padrão de continuação de baixa',
        timestamp: data[data.length - 1].timestamp,
        startIndex: poleStart,
        endIndex: flagEnd,
        keyLevels: {
          resistance: Math.max(...flagData.map(c => c.high)),
          target: data[flagEnd].close + (poleData[poleEnd - 1].close - poleData[0].close),
        },
      };
    }

    return null;
  }

  /**
   * Detecta Pennant (similar a Flag mas com convergência)
   */
  private detectPennant(data: OHLCVData[]): ChartPatternResult | null {
    if (data.length < 30) return null;

    const poleStart = data.length - 30;
    const poleEnd = data.length - 15;
    const pennantStart = poleEnd;
    const pennantEnd = data.length - 1;

    const poleData = data.slice(poleStart, poleEnd);
    const pennantData = data.slice(pennantStart, pennantEnd);

    const poleMove = (poleData[poleData.length - 1].close - poleData[0].close) / poleData[0].close;

    // Verificar convergência no pennant
    const pennantHighs = pennantData.map(c => c.high);
    const pennantLows = pennantData.map(c => c.low);
    const highTrend = this.calculateTrend(pennantHighs);
    const lowTrend = this.calculateTrend(pennantLows);

    // Bullish Pennant
    if (poleMove > 0.05 && highTrend < 0 && lowTrend > 0) {
      return {
        type: 'PENNANT_BULLISH',
        direction: 'BULLISH',
        confidence: 0.7,
        reliability: 'MEDIUM',
        description: 'Bullish Pennant - Padrão de continuação de alta',
        timestamp: data[data.length - 1].timestamp,
        startIndex: poleStart,
        endIndex: pennantEnd,
        keyLevels: {
          target: data[pennantEnd].close + Math.abs(poleData[poleEnd - 1].close - poleData[0].close),
        },
      };
    }

    // Bearish Pennant
    if (poleMove < -0.05 && highTrend < 0 && lowTrend > 0) {
      return {
        type: 'PENNANT_BEARISH',
        direction: 'BEARISH',
        confidence: 0.7,
        reliability: 'MEDIUM',
        description: 'Bearish Pennant - Padrão de continuação de baixa',
        timestamp: data[data.length - 1].timestamp,
        startIndex: poleStart,
        endIndex: pennantEnd,
        keyLevels: {
          target: data[pennantEnd].close - Math.abs(poleData[poleEnd - 1].close - poleData[0].close),
        },
      };
    }

    return null;
  }

  /**
   * Detecta Wedge (Rising/Falling)
   */
  private detectWedge(data: OHLCVData[]): ChartPatternResult | null {
    if (data.length < 40) return null;

    const recentData = data.slice(-40);
    const highs = recentData.map(c => c.high);
    const lows = recentData.map(c => c.low);

    const highTrend = this.calculateTrend(highs);
    const lowTrend = this.calculateTrend(lows);

    // Rising Wedge (ambos subindo, mas convergindo)
    if (highTrend > 0 && lowTrend > 0 && lowTrend > highTrend * 1.2) {
      return {
        type: 'WEDGE_RISING',
        direction: 'BEARISH',
        confidence: 0.65,
        reliability: 'MEDIUM',
        description: 'Rising Wedge - Padrão de reversão de baixa',
        timestamp: data[data.length - 1].timestamp,
        startIndex: data.length - 40,
        endIndex: data.length - 1,
        keyLevels: {
          support: lows[lows.length - 1],
        },
      };
    }

    // Falling Wedge (ambos caindo, mas convergindo)
    if (highTrend < 0 && lowTrend < 0 && highTrend < lowTrend * 1.2) {
      return {
        type: 'WEDGE_FALLING',
        direction: 'BULLISH',
        confidence: 0.65,
        reliability: 'MEDIUM',
        description: 'Falling Wedge - Padrão de reversão de alta',
        timestamp: data[data.length - 1].timestamp,
        startIndex: data.length - 40,
        endIndex: data.length - 1,
        keyLevels: {
          resistance: highs[highs.length - 1],
        },
      };
    }

    return null;
  }

  /**
   * Detecta Channel (Ascending/Descending)
   */
  private detectChannel(data: OHLCVData[]): ChartPatternResult | null {
    if (data.length < 50) return null;

    const recentData = data.slice(-50);
    const highs = recentData.map(c => c.high);
    const lows = recentData.map(c => c.low);

    const highTrend = this.calculateTrend(highs);
    const lowTrend = this.calculateTrend(lows);

    const trendDiff = Math.abs(highTrend - lowTrend) / Math.abs(highTrend);

    // Canal paralelo (trends similares)
    if (trendDiff < 0.2) {
      if (highTrend > 0.001 && lowTrend > 0.001) {
        return {
          type: 'CHANNEL_ASCENDING',
          direction: 'BULLISH',
          confidence: 0.7,
          reliability: 'MEDIUM',
          description: 'Canal Ascendente - Tendência de alta',
          timestamp: data[data.length - 1].timestamp,
          startIndex: data.length - 50,
          endIndex: data.length - 1,
          keyLevels: {
            support: lows[lows.length - 1],
            resistance: highs[highs.length - 1],
          },
        };
      }

      if (highTrend < -0.001 && lowTrend < -0.001) {
        return {
          type: 'CHANNEL_DESCENDING',
          direction: 'BEARISH',
          confidence: 0.7,
          reliability: 'MEDIUM',
          description: 'Canal Descendente - Tendência de baixa',
          timestamp: data[data.length - 1].timestamp,
          startIndex: data.length - 50,
          endIndex: data.length - 1,
          keyLevels: {
            support: lows[lows.length - 1],
            resistance: highs[highs.length - 1],
          },
        };
      }
    }

    return null;
  }

  /**
   * Detecta Cup and Handle
   */
  private detectCupAndHandle(data: OHLCVData[]): ChartPatternResult | null {
    if (data.length < 60) return null;

    const cupData = data.slice(-60, -15);
    const handleData = data.slice(-15);

    // Verificar formato de "U" na cup
    const cupLows = cupData.map(c => c.low);
    const cupMin = Math.min(...cupLows);
    const cupMinIndex = cupLows.indexOf(cupMin);

    // Cup deve ter formato arredondado
    if (cupMinIndex < 15 || cupMinIndex > cupData.length - 15) return null;

    // Handle deve ser uma pequena correção
    const handleMove = (handleData[handleData.length - 1].close - handleData[0].close) / handleData[0].close;

    if (handleMove > -0.15 && handleMove < 0.05) {
      const resistance = Math.max(...cupData.map(c => c.high));
      const target = resistance + (resistance - cupMin);

      return {
        type: 'CUP_AND_HANDLE',
        direction: 'BULLISH',
        confidence: 0.75,
        reliability: 'HIGH',
        description: 'Cup and Handle - Padrão de continuação de alta',
        timestamp: data[data.length - 1].timestamp,
        startIndex: data.length - 60,
        endIndex: data.length - 1,
        keyLevels: {
          support: cupMin,
          resistance,
          target,
        },
      };
    }

    return null;
  }

  /**
   * Detecta Rounding Bottom
   */
  private detectRoundingBottom(data: OHLCVData[]): ChartPatternResult | null {
    if (data.length < 50) return null;

    const recentData = data.slice(-50);
    const lows = recentData.map(c => c.low);

    // Verificar formato arredondado
    const firstThird = lows.slice(0, 17);
    const middleThird = lows.slice(17, 34);
    const lastThird = lows.slice(34);

    const firstAvg = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
    const middleAvg = middleThird.reduce((a, b) => a + b, 0) / middleThird.length;
    const lastAvg = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;

    // Middle deve ser menor que first e last
    if (middleAvg < firstAvg * 0.98 && middleAvg < lastAvg * 0.98) {
      const support = Math.min(...lows);
      const resistance = Math.max(...recentData.map(c => c.high));

      return {
        type: 'ROUNDING_BOTTOM',
        direction: 'BULLISH',
        confidence: 0.7,
        reliability: 'MEDIUM',
        description: 'Rounding Bottom - Padrão de reversão de alta',
        timestamp: data[data.length - 1].timestamp,
        startIndex: data.length - 50,
        endIndex: data.length - 1,
        keyLevels: {
          support,
          resistance,
          target: resistance + (resistance - support),
        },
      };
    }

    return null;
  }

  /**
   * Calcula tendência (slope) de uma série
   */
  private calculateTrend(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;

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
}
