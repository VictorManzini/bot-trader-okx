/**
 * Transformer Model para Séries Temporais
 * Baseado em arquitetura de atenção para capturar dependências de longo prazo
 */

import * as tf from '@tensorflow/tfjs';

export interface TransformerConfig {
  sequenceLength: number;
  features: number;
  dModel: number;
  numHeads: number;
  numLayers: number;
  dff: number;
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

export class TransformerModel {
  private model: tf.LayersModel | null = null;
  private config: TransformerConfig;
  private isTraining: boolean = false;

  constructor(config?: Partial<TransformerConfig>) {
    this.config = {
      sequenceLength: config?.sequenceLength || 60,
      features: config?.features || 5, // OHLCV
      dModel: config?.dModel || 128,
      numHeads: config?.numHeads || 8,
      numLayers: config?.numLayers || 4,
      dff: config?.dff || 512,
      dropout: config?.dropout || 0.1,
      learningRate: config?.learningRate || 0.0001,
      epochs: config?.epochs || 100,
      batchSize: config?.batchSize || 32,
    };
  }

  /**
   * Cria camada de atenção multi-head simplificada
   */
  private createMultiHeadAttention(dModel: number, numHeads: number): tf.LayersModel {
    const input = tf.input({ shape: [null, dModel] });
    
    // Query, Key, Value projections
    const q = tf.layers.dense({ units: dModel }).apply(input) as tf.SymbolicTensor;
    const k = tf.layers.dense({ units: dModel }).apply(input) as tf.SymbolicTensor;
    const v = tf.layers.dense({ units: dModel }).apply(input) as tf.SymbolicTensor;

    // Simplified attention (sem split de heads para simplificar)
    // Em produção, implementar split real de heads
    const attention = tf.layers.attention().apply([q, v, k]) as tf.SymbolicTensor;
    
    const output = tf.layers.dense({ units: dModel }).apply(attention) as tf.SymbolicTensor;

    return tf.model({ inputs: input, outputs: output });
  }

  /**
   * Constrói a arquitetura do Transformer
   */
  buildModel(): void {
    const { sequenceLength, features, dModel, numLayers, dff, dropout, learningRate } = this.config;

    const input = tf.input({ shape: [sequenceLength, features] });
    
    // Embedding inicial
    let x = tf.layers.dense({ units: dModel, activation: 'relu' }).apply(input) as tf.SymbolicTensor;

    // Positional encoding (simplificado)
    x = tf.layers.dropout({ rate: dropout }).apply(x) as tf.SymbolicTensor;

    // Transformer encoder layers
    for (let i = 0; i < numLayers; i++) {
      // Multi-head attention (simplificado)
      const attn = tf.layers.multiHeadAttention({
        numHeads: this.config.numHeads,
        keyDim: Math.floor(dModel / this.config.numHeads),
      }).apply([x, x]) as tf.SymbolicTensor;
      
      const attnDrop = tf.layers.dropout({ rate: dropout }).apply(attn) as tf.SymbolicTensor;
      const attnNorm = tf.layers.layerNormalization().apply(
        tf.layers.add().apply([x, attnDrop]) as tf.SymbolicTensor
      ) as tf.SymbolicTensor;

      // Feed-forward network
      let ffn = tf.layers.dense({ units: dff, activation: 'relu' }).apply(attnNorm) as tf.SymbolicTensor;
      ffn = tf.layers.dropout({ rate: dropout }).apply(ffn) as tf.SymbolicTensor;
      ffn = tf.layers.dense({ units: dModel }).apply(ffn) as tf.SymbolicTensor;
      ffn = tf.layers.dropout({ rate: dropout }).apply(ffn) as tf.SymbolicTensor;

      x = tf.layers.layerNormalization().apply(
        tf.layers.add().apply([attnNorm, ffn]) as tf.SymbolicTensor
      ) as tf.SymbolicTensor;
    }

    // Global pooling e saída
    x = tf.layers.globalAveragePooling1d().apply(x) as tf.SymbolicTensor;
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

    console.log('✅ Transformer Model construído com sucesso');
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
      console.log('🔄 Iniciando treinamento do Transformer...');
      
      await this.model!.fit(xTensor, yTensor, {
        epochs: this.config.epochs,
        batchSize: this.config.batchSize,
        validationSplit: 0.2,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 10 === 0) {
              console.log(`Epoch ${epoch + 1}/${this.config.epochs} - Loss: ${logs?.loss.toFixed(4)} - MAE: ${logs?.mae.toFixed(4)}`);
            }
          },
        },
      });

      console.log('✅ Treinamento do Transformer concluído');
    } catch (error) {
      console.error('❌ Erro no treinamento do Transformer:', error);
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
      console.error('❌ Erro na previsão do Transformer:', error);
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
    console.log(`✅ Modelo Transformer salvo em: ${path}`);
  }

  /**
   * Carrega um modelo previamente treinado
   */
  async loadModel(path: string): Promise<void> {
    this.model = await tf.loadLayersModel(`file://${path}/model.json`);
    console.log(`✅ Modelo Transformer carregado de: ${path}`);
  }

  /**
   * Libera recursos do modelo
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      console.log('🗑️ Modelo Transformer descartado');
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
