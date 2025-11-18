/**
 * TCN (Temporal Convolutional Network) Model
 * Para capturar padrões temporais de longo prazo em séries temporais
 */

import * as tf from '@tensorflow/tfjs';

export interface TCNConfig {
  sequenceLength: number;
  features: number;
  filters: number[];
  kernelSize: number;
  dilations: number[];
  dropout: number;
  learningRate: number;
  epochs: number;
  batchSize: number;
}

export interface PredictionResult {
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  predictedPrice: number;
  confidence: number;
  timestamp: number;
}

export class TCNModel {
  private model: tf.LayersModel | null = null;
  private config: TCNConfig;
  private isTraining: boolean = false;

  constructor(config?: Partial<TCNConfig>) {
    this.config = {
      sequenceLength: config?.sequenceLength || 60,
      features: config?.features || 5, // OHLCV
      filters: config?.filters || [64, 64, 64],
      kernelSize: config?.kernelSize || 3,
      dilations: config?.dilations || [1, 2, 4, 8],
      dropout: config?.dropout || 0.2,
      learningRate: config?.learningRate || 0.001,
      epochs: config?.epochs || 50,
      batchSize: config?.batchSize || 32,
    };
  }

  /**
   * Constrói a arquitetura da rede TCN
   */
  buildModel(): void {
    const { sequenceLength, features, filters, kernelSize, dilations, dropout, learningRate } = this.config;

    const input = tf.input({ shape: [sequenceLength, features] });
    let x: tf.SymbolicTensor = input;

    // Camadas convolucionais temporais com dilatação
    for (let i = 0; i < filters.length; i++) {
      for (const dilation of dilations) {
        // Convolução causal (não olha para o futuro)
        const conv = tf.layers.conv1d({
          filters: filters[i],
          kernelSize,
          padding: 'causal',
          dilation: dilation,
          activation: 'relu',
        }).apply(x) as tf.SymbolicTensor;

        const drop = tf.layers.dropout({ rate: dropout }).apply(conv) as tf.SymbolicTensor;

        // Residual connection
        if (i > 0) {
          x = tf.layers.add().apply([x, drop]) as tf.SymbolicTensor;
        } else {
          x = drop;
        }
      }
    }

    // Global pooling
    x = tf.layers.globalAveragePooling1d().apply(x) as tf.SymbolicTensor;

    // Camadas densas finais
    x = tf.layers.dense({ units: 64, activation: 'relu' }).apply(x) as tf.SymbolicTensor;
    x = tf.layers.dropout({ rate: dropout }).apply(x) as tf.SymbolicTensor;
    const output = tf.layers.dense({ units: 1, activation: 'linear' }).apply(x) as tf.SymbolicTensor;

    // Criar modelo
    this.model = tf.model({ inputs: input, outputs: output });

    // Compilar modelo
    this.model.compile({
      optimizer: tf.train.adam(learningRate),
      loss: 'meanSquaredError',
      metrics: ['mae'],
    });

    console.log('✅ TCN Model construído com sucesso');
  }

  /**
   * Treina o modelo com dados históricos
   */
  async train(X: number[][][], y: number[][]): Promise<void> {
    if (!this.model) {
      this.buildModel();
    }

    this.isTraining = true;

    const xTensor = tf.tensor3d(X);
    const yTensor = tf.tensor2d(y);

    try {
      console.log('🔄 Iniciando treinamento do TCN...');
      
      await this.model!.fit(xTensor, yTensor, {
        epochs: this.config.epochs,
        batchSize: this.config.batchSize,
        validationSplit: 0.2,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Epoch ${epoch + 1}/${this.config.epochs} - Loss: ${logs?.loss.toFixed(4)} - MAE: ${logs?.mae.toFixed(4)}`);
          },
        },
      });

      console.log('✅ Treinamento do TCN concluído');
    } catch (error) {
      console.error('❌ Erro no treinamento do TCN:', error);
      throw error;
    } finally {
      xTensor.dispose();
      yTensor.dispose();
      this.isTraining = false;
    }
  }

  /**
   * Faz previsão em tempo real
   */
  async predict(sequence: number[][]): Promise<PredictionResult> {
    if (!this.model) {
      throw new Error('Modelo não foi treinado ainda');
    }

    if (this.isTraining) {
      throw new Error('Modelo está em treinamento');
    }

    const inputTensor = tf.tensor3d([sequence]);
    
    try {
      const prediction = this.model.predict(inputTensor) as tf.Tensor;
      const predictedValue = (await prediction.data())[0];
      
      // Calcular direção e confiança
      const currentPrice = sequence[sequence.length - 1][3]; // Close price
      const priceChange = ((predictedValue - currentPrice) / currentPrice) * 100;
      
      let direction: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
      let confidence = Math.abs(priceChange);

      if (priceChange > 0.5) {
        direction = 'UP';
      } else if (priceChange < -0.5) {
        direction = 'DOWN';
      }

      // Normalizar confiança entre 0 e 1
      confidence = Math.min(confidence / 5, 1);

      prediction.dispose();
      inputTensor.dispose();

      return {
        direction,
        predictedPrice: predictedValue,
        confidence,
        timestamp: Date.now(),
      };
    } catch (error) {
      inputTensor.dispose();
      console.error('❌ Erro na previsão do TCN:', error);
      throw error;
    }
  }

  /**
   * Salva o modelo treinado
   */
  async saveModel(path: string): Promise<void> {
    if (!this.model) {
      throw new Error('Nenhum modelo para salvar');
    }

    await this.model.save(`file://${path}`);
    console.log(`✅ Modelo TCN salvo em: ${path}`);
  }

  /**
   * Carrega um modelo previamente treinado
   */
  async loadModel(path: string): Promise<void> {
    this.model = await tf.loadLayersModel(`file://${path}/model.json`);
    console.log(`✅ Modelo TCN carregado de: ${path}`);
  }

  /**
   * Libera recursos do modelo
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      console.log('🗑️ Modelo TCN descartado');
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
      layers: this.model.layers.length,
      trainable: this.model.trainable,
    };
  }
}
