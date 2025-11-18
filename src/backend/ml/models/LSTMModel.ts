/**
 * LSTM (Long Short-Term Memory) Model
 * Para previsão de séries temporais de preços de criptomoedas
 */

import * as tf from '@tensorflow/tfjs';

export interface LSTMConfig {
  sequenceLength: number;
  features: number;
  lstmUnits: number[];
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

export class LSTMModel {
  private model: tf.LayersModel | null = null;
  private config: LSTMConfig;
  private isTraining: boolean = false;

  constructor(config?: Partial<LSTMConfig>) {
    this.config = {
      sequenceLength: config?.sequenceLength || 60,
      features: config?.features || 5, // OHLCV
      lstmUnits: config?.lstmUnits || [128, 64, 32],
      dropout: config?.dropout || 0.2,
      learningRate: config?.learningRate || 0.001,
      epochs: config?.epochs || 50,
      batchSize: config?.batchSize || 32,
    };
  }

  /**
   * Constrói a arquitetura da rede LSTM
   */
  buildModel(): void {
    const { sequenceLength, features, lstmUnits, dropout, learningRate } = this.config;

    const model = tf.sequential();

    // Primeira camada LSTM
    model.add(tf.layers.lstm({
      units: lstmUnits[0],
      returnSequences: lstmUnits.length > 1,
      inputShape: [sequenceLength, features],
    }));
    model.add(tf.layers.dropout({ rate: dropout }));

    // Camadas LSTM intermediárias
    for (let i = 1; i < lstmUnits.length; i++) {
      model.add(tf.layers.lstm({
        units: lstmUnits[i],
        returnSequences: i < lstmUnits.length - 1,
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
    console.log('✅ LSTM Model construído com sucesso');
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
      console.log('🔄 Iniciando treinamento do LSTM...');
      
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

      console.log('✅ Treinamento do LSTM concluído');
    } catch (error) {
      console.error('❌ Erro no treinamento do LSTM:', error);
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
      console.error('❌ Erro na previsão do LSTM:', error);
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
    console.log(`✅ Modelo LSTM salvo em: ${path}`);
  }

  /**
   * Carrega um modelo previamente treinado
   */
  async loadModel(path: string): Promise<void> {
    this.model = await tf.loadLayersModel(`file://${path}/model.json`);
    console.log(`✅ Modelo LSTM carregado de: ${path}`);
  }

  /**
   * Libera recursos do modelo
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      console.log('🗑️ Modelo LSTM descartado');
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
