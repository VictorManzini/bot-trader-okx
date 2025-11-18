/**
 * GRU (Gated Recurrent Unit) Model
 * Alternativa mais leve ao LSTM para previsão de séries temporais
 */

import * as tf from '@tensorflow/tfjs';

export interface GRUConfig {
  sequenceLength: number;
  features: number;
  gruUnits: number[];
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

export class GRUModel {
  private model: tf.LayersModel | null = null;
  private config: GRUConfig;
  private isTraining: boolean = false;

  constructor(config?: Partial<GRUConfig>) {
    this.config = {
      sequenceLength: config?.sequenceLength || 60,
      features: config?.features || 5, // OHLCV
      gruUnits: config?.gruUnits || [128, 64],
      dropout: config?.dropout || 0.2,
      learningRate: config?.learningRate || 0.001,
      epochs: config?.epochs || 50,
      batchSize: config?.batchSize || 32,
    };
  }

  /**
   * Constrói a arquitetura da rede GRU
   */
  buildModel(): void {
    const { sequenceLength, features, gruUnits, dropout, learningRate } = this.config;

    const model = tf.sequential();

    // Primeira camada GRU
    model.add(tf.layers.gru({
      units: gruUnits[0],
      returnSequences: gruUnits.length > 1,
      inputShape: [sequenceLength, features],
    }));
    model.add(tf.layers.dropout({ rate: dropout }));

    // Camadas GRU intermediárias
    for (let i = 1; i < gruUnits.length; i++) {
      model.add(tf.layers.gru({
        units: gruUnits[i],
        returnSequences: i < gruUnits.length - 1,
      }));
      model.add(tf.layers.dropout({ rate: dropout }));
    }

    // Camadas densas para saída
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: dropout }));
    model.add(tf.layers.dense({ units: 1, activation: 'linear' }));

    // Compilar modelo
    model.compile({
      optimizer: tf.train.adam(learningRate),
      loss: 'meanSquaredError',
      metrics: ['mae'],
    });

    this.model = model;
    console.log('✅ GRU Model construído com sucesso');
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
      console.log('🔄 Iniciando treinamento do GRU...');
      
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

      console.log('✅ Treinamento do GRU concluído');
    } catch (error) {
      console.error('❌ Erro no treinamento do GRU:', error);
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
      console.error('❌ Erro na previsão do GRU:', error);
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
    console.log(`✅ Modelo GRU salvo em: ${path}`);
  }

  /**
   * Carrega um modelo previamente treinado
   */
  async loadModel(path: string): Promise<void> {
    this.model = await tf.loadLayersModel(`file://${path}/model.json`);
    console.log(`✅ Modelo GRU carregado de: ${path}`);
  }

  /**
   * Libera recursos do modelo
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      console.log('🗑️ Modelo GRU descartado');
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
