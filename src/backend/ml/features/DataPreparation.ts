/**
 * Utilitários para preparação de dados para modelos de ML
 * Normalização, divisão de datasets, balanceamento, etc.
 */

import { OHLCVData, MultiTimeframeData, AdvancedFeatures } from './FeatureEngineering';

export interface DatasetSplit {
  train: {
    X: number[][];
    y: number[];
  };
  validation: {
    X: number[][];
    y: number[];
  };
  test: {
    X: number[][];
    y: number[];
  };
}

export interface NormalizationParams {
  mean: number[];
  std: number[];
  min: number[];
  max: number[];
}

export class DataPreparation {
  /**
   * Divide dataset em treino, validação e teste
   */
  splitDataset(
    X: number[][],
    y: number[],
    trainRatio: number = 0.7,
    validationRatio: number = 0.15,
    testRatio: number = 0.15
  ): DatasetSplit {
    if (trainRatio + validationRatio + testRatio !== 1) {
      throw new Error('Ratios devem somar 1.0');
    }

    const totalSamples = X.length;
    const trainSize = Math.floor(totalSamples * trainRatio);
    const validationSize = Math.floor(totalSamples * validationRatio);

    return {
      train: {
        X: X.slice(0, trainSize),
        y: y.slice(0, trainSize),
      },
      validation: {
        X: X.slice(trainSize, trainSize + validationSize),
        y: y.slice(trainSize, trainSize + validationSize),
      },
      test: {
        X: X.slice(trainSize + validationSize),
        y: y.slice(trainSize + validationSize),
      },
    };
  }

  /**
   * Normalização Z-Score (standardization)
   */
  zScoreNormalization(data: number[][]): { normalized: number[][]; params: NormalizationParams } {
    const numFeatures = data[0].length;
    const mean: number[] = new Array(numFeatures).fill(0);
    const std: number[] = new Array(numFeatures).fill(0);

    // Calcular média
    for (let i = 0; i < data.length; i++) {
      for (let j = 0; j < numFeatures; j++) {
        mean[j] += data[i][j];
      }
    }
    mean.forEach((_, i) => (mean[i] /= data.length));

    // Calcular desvio padrão
    for (let i = 0; i < data.length; i++) {
      for (let j = 0; j < numFeatures; j++) {
        std[j] += Math.pow(data[i][j] - mean[j], 2);
      }
    }
    std.forEach((_, i) => (std[i] = Math.sqrt(std[i] / data.length)));

    // Normalizar
    const normalized = data.map(row =>
      row.map((val, j) => (std[j] !== 0 ? (val - mean[j]) / std[j] : 0))
    );

    return {
      normalized,
      params: {
        mean,
        std,
        min: [],
        max: [],
      },
    };
  }

  /**
   * Normalização Min-Max
   */
  minMaxNormalization(
    data: number[][],
    featureRange: [number, number] = [0, 1]
  ): { normalized: number[][]; params: NormalizationParams } {
    const numFeatures = data[0].length;
    const min: number[] = new Array(numFeatures).fill(Infinity);
    const max: number[] = new Array(numFeatures).fill(-Infinity);

    // Encontrar min e max
    for (let i = 0; i < data.length; i++) {
      for (let j = 0; j < numFeatures; j++) {
        if (data[i][j] < min[j]) min[j] = data[i][j];
        if (data[i][j] > max[j]) max[j] = data[i][j];
      }
    }

    // Normalizar
    const [rangeMin, rangeMax] = featureRange;
    const normalized = data.map(row =>
      row.map((val, j) => {
        const range = max[j] - min[j];
        if (range === 0) return rangeMin;
        return ((val - min[j]) / range) * (rangeMax - rangeMin) + rangeMin;
      })
    );

    return {
      normalized,
      params: {
        mean: [],
        std: [],
        min,
        max,
      },
    };
  }

  /**
   * Aplica normalização usando parâmetros salvos
   */
  applyNormalization(data: number[][], params: NormalizationParams, method: 'zscore' | 'minmax'): number[][] {
    if (method === 'zscore') {
      return data.map(row =>
        row.map((val, j) => (params.std[j] !== 0 ? (val - params.mean[j]) / params.std[j] : 0))
      );
    } else {
      return data.map(row =>
        row.map((val, j) => {
          const range = params.max[j] - params.min[j];
          if (range === 0) return 0;
          return (val - params.min[j]) / range;
        })
      );
    }
  }

  /**
   * Cria labels para classificação (UP/DOWN/NEUTRAL)
   */
  createClassificationLabels(
    prices: number[],
    lookAhead: number = 1,
    threshold: number = 0.5
  ): number[] {
    const labels: number[] = [];

    for (let i = 0; i < prices.length - lookAhead; i++) {
      const currentPrice = prices[i];
      const futurePrice = prices[i + lookAhead];
      const priceChange = ((futurePrice - currentPrice) / currentPrice) * 100;

      if (priceChange > threshold) {
        labels.push(1); // UP
      } else if (priceChange < -threshold) {
        labels.push(-1); // DOWN
      } else {
        labels.push(0); // NEUTRAL
      }
    }

    return labels;
  }

  /**
   * Cria labels para regressão (preço futuro)
   */
  createRegressionLabels(prices: number[], lookAhead: number = 1): number[] {
    const labels: number[] = [];

    for (let i = 0; i < prices.length - lookAhead; i++) {
      labels.push(prices[i + lookAhead]);
    }

    return labels;
  }

  /**
   * Balanceamento de classes (SMOTE simplificado)
   */
  balanceClasses(X: number[][], y: number[]): { X: number[][]; y: number[] } {
    // Contar amostras por classe
    const classCounts = new Map<number, number>();
    y.forEach(label => {
      classCounts.set(label, (classCounts.get(label) || 0) + 1);
    });

    // Encontrar classe majoritária
    const maxCount = Math.max(...Array.from(classCounts.values()));

    // Separar por classe
    const classSamples = new Map<number, number[][]>();
    y.forEach((label, i) => {
      if (!classSamples.has(label)) {
        classSamples.set(label, []);
      }
      classSamples.get(label)!.push(X[i]);
    });

    // Oversample classes minoritárias
    const balancedX: number[][] = [];
    const balancedY: number[] = [];

    classSamples.forEach((samples, label) => {
      // Adicionar amostras originais
      balancedX.push(...samples);
      balancedY.push(...new Array(samples.length).fill(label));

      // Oversample se necessário
      const needMore = maxCount - samples.length;
      for (let i = 0; i < needMore; i++) {
        const randomIndex = Math.floor(Math.random() * samples.length);
        balancedX.push([...samples[randomIndex]]);
        balancedY.push(label);
      }
    });

    return { X: balancedX, y: balancedY };
  }

  /**
   * Shuffle dataset
   */
  shuffleDataset(X: number[][], y: number[]): { X: number[][]; y: number[] } {
    const indices = Array.from({ length: X.length }, (_, i) => i);
    
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    return {
      X: indices.map(i => X[i]),
      y: indices.map(i => y[i]),
    };
  }

  /**
   * Remove outliers usando IQR
   */
  removeOutliers(X: number[][], y: number[], iqrMultiplier: number = 1.5): { X: number[][]; y: number[] } {
    const numFeatures = X[0].length;
    const validIndices: number[] = [];

    // Para cada feature, calcular IQR
    for (let j = 0; j < numFeatures; j++) {
      const values = X.map(row => row[j]).sort((a, b) => a - b);
      const q1Index = Math.floor(values.length * 0.25);
      const q3Index = Math.floor(values.length * 0.75);
      const q1 = values[q1Index];
      const q3 = values[q3Index];
      const iqr = q3 - q1;
      const lowerBound = q1 - iqrMultiplier * iqr;
      const upperBound = q3 + iqrMultiplier * iqr;

      // Marcar índices válidos
      X.forEach((row, i) => {
        if (row[j] >= lowerBound && row[j] <= upperBound) {
          if (!validIndices.includes(i)) {
            validIndices.push(i);
          }
        }
      });
    }

    return {
      X: validIndices.map(i => X[i]),
      y: validIndices.map(i => y[i]),
    };
  }

  /**
   * Cria janelas deslizantes (sliding windows) para séries temporais
   */
  createSlidingWindows(
    data: number[][],
    windowSize: number,
    stepSize: number = 1
  ): number[][][] {
    const windows: number[][][] = [];

    for (let i = 0; i <= data.length - windowSize; i += stepSize) {
      windows.push(data.slice(i, i + windowSize));
    }

    return windows;
  }

  /**
   * Adiciona features de lag (valores passados)
   */
  addLagFeatures(data: number[][], lags: number[]): number[][] {
    const result: number[][] = [];

    for (let i = Math.max(...lags); i < data.length; i++) {
      const row = [...data[i]];
      
      for (const lag of lags) {
        row.push(...data[i - lag]);
      }
      
      result.push(row);
    }

    return result;
  }

  /**
   * Calcula pesos para classes desbalanceadas
   */
  calculateClassWeights(y: number[]): Map<number, number> {
    const classCounts = new Map<number, number>();
    y.forEach(label => {
      classCounts.set(label, (classCounts.get(label) || 0) + 1);
    });

    const totalSamples = y.length;
    const numClasses = classCounts.size;
    const weights = new Map<number, number>();

    classCounts.forEach((count, label) => {
      weights.set(label, totalSamples / (numClasses * count));
    });

    return weights;
  }

  /**
   * Validação cruzada K-Fold
   */
  kFoldSplit(X: number[][], y: number[], k: number = 5): Array<{
    train: { X: number[][]; y: number[] };
    validation: { X: number[][]; y: number[] };
  }> {
    const foldSize = Math.floor(X.length / k);
    const folds: Array<{
      train: { X: number[][]; y: number[] };
      validation: { X: number[][]; y: number[] };
    }> = [];

    for (let i = 0; i < k; i++) {
      const validationStart = i * foldSize;
      const validationEnd = (i + 1) * foldSize;

      const trainX = [...X.slice(0, validationStart), ...X.slice(validationEnd)];
      const trainY = [...y.slice(0, validationStart), ...y.slice(validationEnd)];
      const validationX = X.slice(validationStart, validationEnd);
      const validationY = y.slice(validationStart, validationEnd);

      folds.push({
        train: { X: trainX, y: trainY },
        validation: { X: validationX, y: validationY },
      });
    }

    return folds;
  }

  /**
   * Calcula métricas de avaliação
   */
  calculateMetrics(yTrue: number[], yPred: number[]): {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    confusionMatrix: number[][];
  } {
    if (yTrue.length !== yPred.length) {
      throw new Error('Arrays devem ter o mesmo tamanho');
    }

    // Classes únicas
    const classes = Array.from(new Set([...yTrue, ...yPred])).sort();
    const numClasses = classes.length;

    // Matriz de confusão
    const confusionMatrix: number[][] = Array(numClasses)
      .fill(0)
      .map(() => Array(numClasses).fill(0));

    for (let i = 0; i < yTrue.length; i++) {
      const trueIndex = classes.indexOf(yTrue[i]);
      const predIndex = classes.indexOf(yPred[i]);
      confusionMatrix[trueIndex][predIndex]++;
    }

    // Accuracy
    let correct = 0;
    for (let i = 0; i < yTrue.length; i++) {
      if (yTrue[i] === yPred[i]) correct++;
    }
    const accuracy = correct / yTrue.length;

    // Precision, Recall, F1 (macro average)
    let totalPrecision = 0;
    let totalRecall = 0;

    for (let i = 0; i < numClasses; i++) {
      const tp = confusionMatrix[i][i];
      const fp = confusionMatrix.reduce((sum, row, j) => (j !== i ? sum + row[i] : sum), 0);
      const fn = confusionMatrix[i].reduce((sum, val, j) => (j !== i ? sum + val : sum), 0);

      const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
      const recall = tp + fn > 0 ? tp / (tp + fn) : 0;

      totalPrecision += precision;
      totalRecall += recall;
    }

    const precision = totalPrecision / numClasses;
    const recall = totalRecall / numClasses;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      accuracy,
      precision,
      recall,
      f1Score,
      confusionMatrix,
    };
  }

  /**
   * Calcula métricas de regressão
   */
  calculateRegressionMetrics(yTrue: number[], yPred: number[]): {
    mae: number;
    mse: number;
    rmse: number;
    r2: number;
    mape: number;
  } {
    if (yTrue.length !== yPred.length) {
      throw new Error('Arrays devem ter o mesmo tamanho');
    }

    const n = yTrue.length;

    // MAE (Mean Absolute Error)
    const mae = yTrue.reduce((sum, val, i) => sum + Math.abs(val - yPred[i]), 0) / n;

    // MSE (Mean Squared Error)
    const mse = yTrue.reduce((sum, val, i) => sum + Math.pow(val - yPred[i], 2), 0) / n;

    // RMSE (Root Mean Squared Error)
    const rmse = Math.sqrt(mse);

    // R² (Coefficient of Determination)
    const yMean = yTrue.reduce((sum, val) => sum + val, 0) / n;
    const ssTot = yTrue.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const ssRes = yTrue.reduce((sum, val, i) => sum + Math.pow(val - yPred[i], 2), 0);
    const r2 = 1 - ssRes / ssTot;

    // MAPE (Mean Absolute Percentage Error)
    const mape =
      (yTrue.reduce((sum, val, i) => {
        if (val === 0) return sum;
        return sum + Math.abs((val - yPred[i]) / val);
      }, 0) /
        n) *
      100;

    return {
      mae,
      mse,
      rmse,
      r2,
      mape,
    };
  }
}
