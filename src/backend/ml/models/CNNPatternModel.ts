/**
 * CNN (Convolutional Neural Network) para Detecção de Padrões Gráficos
 * Detecta padrões como: ombro-cabeça-ombro, triângulos, bandeiras, etc.
 */

import * as tf from '@tensorflow/tfjs';

export interface CNNConfig {
  imageSize: number;
  channels: number;
  filters: number[];
  kernelSizes: number[];
  poolSizes: number[];
  denseUnits: number[];
  dropout: number;
  learningRate: number;
  epochs: number;
  batchSize: number;
}

export interface CandlePattern {
  name: string;
  confidence: number;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  description: string;
}

export interface PatternDetectionResult {
  patterns: CandlePattern[];
  primaryPattern: CandlePattern | null;
  overallDirection: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
  timestamp: number;
}

export class CNNPatternModel {
  private model: tf.LayersModel | null = null;
  private config: CNNConfig;
  private isTraining: boolean = false;
  private patternLabels: string[] = [
    'head_and_shoulders',
    'inverse_head_and_shoulders',
    'double_top',
    'double_bottom',
    'triangle_ascending',
    'triangle_descending',
    'triangle_symmetrical',
    'flag_bullish',
    'flag_bearish',
    'wedge_rising',
    'wedge_falling',
    'channel_ascending',
    'channel_descending',
    'cup_and_handle',
    'no_pattern',
  ];

  constructor(config?: Partial<CNNConfig>) {
    this.config = {
      imageSize: config?.imageSize || 64,
      channels: config?.channels || 1, // Grayscale
      filters: config?.filters || [32, 64, 128],
      kernelSizes: config?.kernelSizes || [3, 3, 3],
      poolSizes: config?.poolSizes || [2, 2, 2],
      denseUnits: config?.denseUnits || [256, 128],
      dropout: config?.dropout || 0.3,
      learningRate: config?.learningRate || 0.001,
      epochs: config?.epochs || 50,
      batchSize: config?.batchSize || 32,
    };
  }

  /**
   * Constrói a arquitetura da CNN
   */
  buildModel(): void {
    const { imageSize, channels, filters, kernelSizes, poolSizes, denseUnits, dropout, learningRate } = this.config;

    const model = tf.sequential();

    // Primeira camada convolucional
    model.add(tf.layers.conv2d({
      inputShape: [imageSize, imageSize, channels],
      filters: filters[0],
      kernelSize: kernelSizes[0],
      activation: 'relu',
      padding: 'same',
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: poolSizes[0] }));
    model.add(tf.layers.dropout({ rate: dropout }));

    // Camadas convolucionais adicionais
    for (let i = 1; i < filters.length; i++) {
      model.add(tf.layers.conv2d({
        filters: filters[i],
        kernelSize: kernelSizes[i],
        activation: 'relu',
        padding: 'same',
      }));
      model.add(tf.layers.maxPooling2d({ poolSize: poolSizes[i] }));
      model.add(tf.layers.dropout({ rate: dropout }));
    }

    // Flatten e camadas densas
    model.add(tf.layers.flatten());

    for (const units of denseUnits) {
      model.add(tf.layers.dense({ units, activation: 'relu' }));
      model.add(tf.layers.dropout({ rate: dropout }));
    }

    // Camada de saída (classificação multi-classe)
    model.add(tf.layers.dense({
      units: this.patternLabels.length,
      activation: 'softmax',
    }));

    // Compilar modelo
    model.compile({
      optimizer: tf.train.adam(learningRate),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    this.model = model;
    console.log('✅ CNN Pattern Model construído com sucesso');
  }

  /**
   * Converte dados OHLCV em imagem de candles
   */
  convertToImage(ohlcv: number[][], size: number = 64): tf.Tensor3D {
    // Criar canvas virtual para desenhar candles
    const canvas = new Array(size).fill(0).map(() => new Array(size).fill(0));
    
    const candles = ohlcv.slice(-50); // Últimos 50 candles
    const maxPrice = Math.max(...candles.map(c => c[2])); // High
    const minPrice = Math.min(...candles.map(c => c[3])); // Low
    const priceRange = maxPrice - minPrice;

    const candleWidth = size / candles.length;

    candles.forEach((candle, i) => {
      const [, open, high, low, close] = candle;
      
      // Normalizar preços para coordenadas da imagem
      const openY = Math.floor(((maxPrice - open) / priceRange) * (size - 1));
      const closeY = Math.floor(((maxPrice - close) / priceRange) * (size - 1));
      const highY = Math.floor(((maxPrice - high) / priceRange) * (size - 1));
      const lowY = Math.floor(((maxPrice - low) / priceRange) * (size - 1));

      const x = Math.floor(i * candleWidth);

      // Desenhar pavio (wick)
      for (let y = highY; y <= lowY; y++) {
        if (y >= 0 && y < size && x >= 0 && x < size) {
          canvas[y][x] = 0.5;
        }
      }

      // Desenhar corpo do candle
      const bodyTop = Math.min(openY, closeY);
      const bodyBottom = Math.max(openY, closeY);
      const intensity = close > open ? 1.0 : 0.3; // Bullish: branco, Bearish: escuro

      for (let y = bodyTop; y <= bodyBottom; y++) {
        for (let dx = 0; dx < Math.max(1, Math.floor(candleWidth * 0.8)); dx++) {
          const px = x + dx;
          if (y >= 0 && y < size && px >= 0 && px < size) {
            canvas[y][px] = intensity;
          }
        }
      }
    });

    // Converter para tensor
    return tf.tensor3d(canvas.map(row => row.map(val => [val])));
  }

  /**
   * Treina o modelo com imagens de padrões
   */
  async train(images: tf.Tensor4D, labels: tf.Tensor2D): Promise<void> {
    if (!this.model) {
      this.buildModel();
    }

    this.isTraining = true;

    try {
      console.log('🔄 Iniciando treinamento do CNN Pattern Model...');
      
      await this.model!.fit(images, labels, {
        epochs: this.config.epochs,
        batchSize: this.config.batchSize,
        validationSplit: 0.2,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Epoch ${epoch + 1}/${this.config.epochs} - Loss: ${logs?.loss.toFixed(4)} - Acc: ${logs?.acc.toFixed(4)}`);
          },
        },
      });

      console.log('✅ Treinamento do CNN Pattern Model concluído');
    } catch (error) {
      console.error('❌ Erro no treinamento do CNN:', error);
      throw error;
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Detecta padrões em tempo real
   */
  async detectPatterns(ohlcv: number[][]): Promise<PatternDetectionResult> {
    if (!this.model) {
      throw new Error('Modelo não foi treinado ainda');
    }

    if (this.isTraining) {
      throw new Error('Modelo está em treinamento');
    }

    // Converter OHLCV para imagem
    const image = this.convertToImage(ohlcv, this.config.imageSize);
    const imageBatch = image.expandDims(0);

    try {
      const prediction = this.model.predict(imageBatch) as tf.Tensor;
      const probabilities = await prediction.data();

      // Identificar padrões detectados
      const patterns: CandlePattern[] = [];
      const threshold = 0.3; // Confiança mínima

      probabilities.forEach((prob, idx) => {
        if (prob > threshold && idx < this.patternLabels.length - 1) {
          const patternName = this.patternLabels[idx];
          const direction = this.getPatternDirection(patternName);
          
          patterns.push({
            name: patternName,
            confidence: prob,
            direction,
            description: this.getPatternDescription(patternName),
          });
        }
      });

      // Ordenar por confiança
      patterns.sort((a, b) => b.confidence - a.confidence);

      // Determinar padrão primário e direção geral
      const primaryPattern = patterns.length > 0 ? patterns[0] : null;
      const overallDirection = this.calculateOverallDirection(patterns);
      const confidence = primaryPattern ? primaryPattern.confidence : 0;

      prediction.dispose();
      imageBatch.dispose();
      image.dispose();

      return {
        patterns,
        primaryPattern,
        overallDirection,
        confidence,
        timestamp: Date.now(),
      };
    } catch (error) {
      imageBatch.dispose();
      image.dispose();
      console.error('❌ Erro na detecção de padrões:', error);
      throw error;
    }
  }

  /**
   * Retorna a direção do padrão
   */
  private getPatternDirection(patternName: string): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    const bullishPatterns = [
      'inverse_head_and_shoulders',
      'double_bottom',
      'triangle_ascending',
      'flag_bullish',
      'wedge_falling',
      'channel_ascending',
      'cup_and_handle',
    ];

    const bearishPatterns = [
      'head_and_shoulders',
      'double_top',
      'triangle_descending',
      'flag_bearish',
      'wedge_rising',
      'channel_descending',
    ];

    if (bullishPatterns.includes(patternName)) return 'BULLISH';
    if (bearishPatterns.includes(patternName)) return 'BEARISH';
    return 'NEUTRAL';
  }

  /**
   * Retorna descrição do padrão
   */
  private getPatternDescription(patternName: string): string {
    const descriptions: Record<string, string> = {
      head_and_shoulders: 'Padrão de reversão de baixa',
      inverse_head_and_shoulders: 'Padrão de reversão de alta',
      double_top: 'Padrão de reversão de baixa',
      double_bottom: 'Padrão de reversão de alta',
      triangle_ascending: 'Padrão de continuação de alta',
      triangle_descending: 'Padrão de continuação de baixa',
      triangle_symmetrical: 'Padrão de continuação neutro',
      flag_bullish: 'Padrão de continuação de alta',
      flag_bearish: 'Padrão de continuação de baixa',
      wedge_rising: 'Padrão de reversão de baixa',
      wedge_falling: 'Padrão de reversão de alta',
      channel_ascending: 'Tendência de alta',
      channel_descending: 'Tendência de baixa',
      cup_and_handle: 'Padrão de continuação de alta',
    };

    return descriptions[patternName] || 'Padrão desconhecido';
  }

  /**
   * Calcula direção geral baseada em múltiplos padrões
   */
  private calculateOverallDirection(patterns: CandlePattern[]): 'UP' | 'DOWN' | 'NEUTRAL' {
    if (patterns.length === 0) return 'NEUTRAL';

    let bullishScore = 0;
    let bearishScore = 0;

    patterns.forEach(pattern => {
      if (pattern.direction === 'BULLISH') {
        bullishScore += pattern.confidence;
      } else if (pattern.direction === 'BEARISH') {
        bearishScore += pattern.confidence;
      }
    });

    if (bullishScore > bearishScore * 1.2) return 'UP';
    if (bearishScore > bullishScore * 1.2) return 'DOWN';
    return 'NEUTRAL';
  }

  /**
   * Salva o modelo treinado
   */
  async saveModel(path: string): Promise<void> {
    if (!this.model) {
      throw new Error('Nenhum modelo para salvar');
    }

    await this.model.save(`file://${path}`);
    console.log(`✅ Modelo CNN Pattern salvo em: ${path}`);
  }

  /**
   * Carrega um modelo previamente treinado
   */
  async loadModel(path: string): Promise<void> {
    this.model = await tf.loadLayersModel(`file://${path}/model.json`);
    console.log(`✅ Modelo CNN Pattern carregado de: ${path}`);
  }

  /**
   * Libera recursos do modelo
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      console.log('🗑️ Modelo CNN Pattern descartado');
    }
  }

  /**
   * Retorna informações sobre o modelo
   */
  getModelInfo(): object {
    if (!this.model) {
      return { status: 'not_initialized' };
    }

    return {
      status: this.isTraining ? 'training' : 'ready',
      config: this.config,
      patterns: this.patternLabels,
      layers: this.model.layers.length,
    };
  }
}
