// Cliente API OKX para trading

import { ApiCredentials, Candle, MarketData, OrderSide, Trade, AccountBalance } from '@/types/trading';

export interface TradingPair {
  instId: string;
  baseCcy: string;
  quoteCcy: string;
  instType: string;
  state: string;
}

export interface CandlePrediction {
  timeframe: string;
  predictedClose: number;
  previousClose?: number; // Preço de fechamento do candle anterior
  recentPrices?: number[]; // Preços recentes para o mini gráfico
  confidence: number;
  timeRemaining: number; // segundos até fechar o candle
  currentTrend: 'bullish' | 'bearish' | 'neutral';
}

export class OKXApiClient {
  private apiKey: string;
  private secretKey: string;
  private passphrase: string;
  private baseUrl = 'https://www.okx.com';
  private isDryRun: boolean;
  
  // Cache para suavização de previsões
  private predictionCache: Map<string, number> = new Map();

  constructor(credentials: ApiCredentials, isDryRun: boolean = true) {
    this.apiKey = credentials.apiKey;
    this.secretKey = credentials.secretKey;
    this.passphrase = credentials.passphrase;
    this.isDryRun = isDryRun;
  }

  // Gerar assinatura para autenticação
  private async generateSignature(
    timestamp: string,
    method: string,
    requestPath: string,
    body: string = ''
  ): Promise<string> {
    const message = timestamp + method + requestPath + body;
    
    // Em ambiente browser, usamos SubtleCrypto
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.secretKey);
    const messageData = encoder.encode(message);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  // Headers para requisições autenticadas
  private async getHeaders(
    method: string,
    requestPath: string,
    body: string = ''
  ): Promise<HeadersInit> {
    const timestamp = new Date().toISOString();
    const signature = await this.generateSignature(timestamp, method, requestPath, body);

    return {
      'OK-ACCESS-KEY': this.apiKey,
      'OK-ACCESS-SIGN': signature,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': this.passphrase,
      'Content-Type': 'application/json',
    };
  }

  // Fazer requisição com retry e fallback
  private async fetchWithFallback(url: string, options: RequestInit = {}): Promise<any> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos timeout

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // Se falhar, retornar null para usar dados simulados
      console.warn(`Requisição falhou para ${url}:`, error);
      return null;
    }
  }

  // Obter todos os pares de trading disponíveis na OKX
  async getTradingPairs(): Promise<TradingPair[]> {
    const data = await this.fetchWithFallback(
      `${this.baseUrl}/api/v5/public/instruments?instType=SPOT`,
      { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    if (!data || data.code !== '0' || !data.data || !Array.isArray(data.data)) {
      console.warn('Usando pares de trading padrão');
      return this.getDefaultTradingPairs();
    }

    return data.data
      .filter((pair: any) => pair.state === 'live')
      .map((pair: any) => ({
        instId: pair.instId,
        baseCcy: pair.baseCcy,
        quoteCcy: pair.quoteCcy,
        instType: pair.instType,
        state: pair.state,
      }));
  }

  // Pares padrão caso a API falhe
  private getDefaultTradingPairs(): TradingPair[] {
    const pairs = [
      'BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'BNB-USDT', 'XRP-USDT',
      'ADA-USDT', 'DOGE-USDT', 'MATIC-USDT', 'DOT-USDT', 'AVAX-USDT',
      'LINK-USDT', 'UNI-USDT', 'ATOM-USDT', 'LTC-USDT', 'ETC-USDT',
      'BCH-USDT', 'XLM-USDT', 'ALGO-USDT', 'VET-USDT', 'ICP-USDT'
    ];

    return pairs.map(pair => {
      const [baseCcy, quoteCcy] = pair.split('-');
      return {
        instId: pair,
        baseCcy,
        quoteCcy,
        instType: 'SPOT',
        state: 'live',
      };
    });
  }

  // Obter dados de mercado em tempo real (público - não requer autenticação)
  async getMarketData(symbol: string): Promise<MarketData> {
    // Normalizar símbolo (BTC-USDT ou BTCUSDT -> BTC-USDT)
    const normalizedSymbol = symbol.includes('-') ? symbol : this.normalizeSymbol(symbol);
    
    const data = await this.fetchWithFallback(
      `${this.baseUrl}/api/v5/market/ticker?instId=${normalizedSymbol}`,
      { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store' // Sempre buscar dados frescos
      }
    );
    
    // Se falhou ou dados inválidos, usar simulação
    if (!data || data.code !== '0' || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
      console.warn('Usando dados de mercado simulados');
      return this.getSimulatedMarketData(normalizedSymbol);
    }

    const ticker = data.data[0];
    
    // Validar campos essenciais
    if (!ticker || !ticker.last) {
      console.warn('Dados do ticker incompletos. Usando dados simulados.');
      return this.getSimulatedMarketData(normalizedSymbol);
    }
    
    return {
      symbol: normalizedSymbol,
      price: parseFloat(ticker.last) || 0,
      change24h: parseFloat(ticker.sodUtc8 || ticker.changePercent || '0'),
      volume24h: parseFloat(ticker.vol24h || '0'),
      high24h: parseFloat(ticker.high24h || ticker.last || '0'),
      low24h: parseFloat(ticker.low24h || ticker.last || '0'),
      timestamp: Date.now(),
    };
  }

  // Normalizar símbolo para formato OKX (BTC-USDT)
  private normalizeSymbol(symbol: string): string {
    if (symbol.includes('-')) return symbol;
    
    // Tentar identificar a moeda base e quote
    const commonQuotes = ['USDT', 'USDC', 'USD', 'BTC', 'ETH'];
    for (const quote of commonQuotes) {
      if (symbol.endsWith(quote)) {
        const base = symbol.slice(0, -quote.length);
        return `${base}-${quote}`;
      }
    }
    
    // Padrão: assumir USDT
    return `${symbol}-USDT`;
  }

  // Gerar dados de mercado simulados para modo DRY RUN ou fallback
  private getSimulatedMarketData(symbol: string): MarketData {
    // Preço base simulado com variação aleatória
    const basePrice = symbol.includes('BTC') ? 45000 : 
                      symbol.includes('ETH') ? 2500 : 
                      symbol.includes('SOL') ? 100 : 1.0;
    
    const variation = (Math.random() - 0.5) * 0.02; // ±1% de variação
    const price = basePrice * (1 + variation);
    
    return {
      symbol,
      price,
      change24h: (Math.random() - 0.5) * 10, // -5% a +5%
      volume24h: Math.random() * 1000000,
      high24h: price * 1.02,
      low24h: price * 0.98,
      timestamp: Date.now(),
    };
  }

  // Obter candles (público)
  async getCandles(
    symbol: string,
    interval: string = '5m',
    limit: number = 100
  ): Promise<Candle[]> {
    // Normalizar símbolo
    const normalizedSymbol = symbol.includes('-') ? symbol : this.normalizeSymbol(symbol);
    
    const data = await this.fetchWithFallback(
      `${this.baseUrl}/api/v5/market/candles?instId=${normalizedSymbol}&bar=${interval}&limit=${limit}`,
      { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      }
    );

    if (!data || data.code !== '0' || !data.data || !Array.isArray(data.data)) {
      console.warn('Usando candles simulados');
      return this.getSimulatedCandles(normalizedSymbol, limit);
    }

    return data.data.map((candle: string[]) => ({
      timestamp: parseInt(candle[0]),
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5]),
    }));
  }

  // Gerar candles simulados
  private getSimulatedCandles(symbol: string, limit: number): Candle[] {
    const basePrice = symbol.includes('BTC') ? 45000 : 
                      symbol.includes('ETH') ? 2500 : 
                      symbol.includes('SOL') ? 100 : 1.0;
    
    const candles: Candle[] = [];
    let currentPrice = basePrice;
    const now = Date.now();
    
    for (let i = limit - 1; i >= 0; i--) {
      const variation = (Math.random() - 0.5) * 0.01; // ±0.5% por candle
      const open = currentPrice;
      const close = currentPrice * (1 + variation);
      const high = Math.max(open, close) * (1 + Math.random() * 0.005);
      const low = Math.min(open, close) * (1 - Math.random() * 0.005);
      
      candles.push({
        timestamp: now - (i * 5 * 60 * 1000), // 5 minutos por candle
        open,
        high,
        low,
        close,
        volume: Math.random() * 1000,
      });
      
      currentPrice = close;
    }
    
    return candles;
  }

  // Calcular previsão de fechamento de candle baseada em dados reais
  async predictCandleClose(
    symbol: string,
    timeframe: '1m' | '15m' | '1h' | '4h'
  ): Promise<CandlePrediction> {
    try {
      const normalizedSymbol = symbol.includes('-') ? symbol : this.normalizeSymbol(symbol);
      
      // Obter candles históricos para análise (mais candles para timeframes maiores)
      const candleLimit = {
        '1m': 30,
        '15m': 50,
        '1h': 100,
        '4h': 200
      }[timeframe];
      
      const candles = await this.getCandles(normalizedSymbol, timeframe, candleLimit);
      const currentPrice = await this.getMarketData(normalizedSymbol);
      
      if (candles.length < 10) {
        throw new Error('Dados insuficientes para previsão');
      }

      // Preço de fechamento do candle anterior (mais recente)
      const previousClose = candles[0].close;
      
      // Preços recentes para o mini gráfico (últimos 20 candles)
      const recentPrices = candles.slice(0, 20).reverse().map(c => c.close);

      // Calcular médias móveis com diferentes períodos baseados no timeframe
      const maPeriods = {
        '1m': { short: 5, medium: 10, long: 20 },
        '15m': { short: 10, medium: 20, long: 30 },
        '1h': { short: 20, medium: 50, long: 100 },
        '4h': { short: 30, medium: 100, long: 150 }
      }[timeframe];
      
      const shortMA = this.calculateMA(candles, maPeriods.short);
      const mediumMA = this.calculateMA(candles, maPeriods.medium);
      const longMA = this.calculateMA(candles, maPeriods.long);
      
      // Calcular EMA (Exponential Moving Average) para capturar tendências recentes
      const ema = this.calculateEMA(candles, maPeriods.short);
      
      // Calcular momentum com diferentes períodos
      const shortMomentum = (currentPrice.price - candles[maPeriods.short - 1].close) / candles[maPeriods.short - 1].close;
      const mediumMomentum = (currentPrice.price - candles[maPeriods.medium - 1].close) / candles[maPeriods.medium - 1].close;
      
      // Calcular volatilidade (ATR - Average True Range)
      const atr = this.calculateATR(candles, 14);
      const volatilityPercent = atr / currentPrice.price;
      
      // Determinar tendência com múltiplos indicadores
      const trendScore = 
        (shortMA > mediumMA ? 1 : -1) +
        (mediumMA > longMA ? 1 : -1) +
        (ema > shortMA ? 1 : -1) +
        (shortMomentum > 0 ? 1 : -1);
      
      const trend: 'bullish' | 'bearish' | 'neutral' = 
        trendScore >= 2 ? 'bullish' :
        trendScore <= -2 ? 'bearish' : 'neutral';
      
      // Calcular volume relativo
      const avgVolume = candles.slice(0, 20).reduce((sum, c) => sum + c.volume, 0) / 20;
      const volumeRatio = candles[0].volume / avgVolume;
      
      // Calcular RSI (Relative Strength Index)
      const rsi = this.calculateRSI(candles, 14);
      
      // PREVISÃO AVANÇADA COM MÚLTIPLOS FATORES
      let predictedClose = currentPrice.price;
      
      // 1. Aplicar momentum ponderado (peso maior para timeframes menores)
      const momentumWeights = { '1m': 0.4, '15m': 0.3, '1h': 0.2, '4h': 0.1 };
      const momentumWeight = momentumWeights[timeframe];
      const combinedMomentum = (shortMomentum * 0.6 + mediumMomentum * 0.4);
      predictedClose += currentPrice.price * combinedMomentum * momentumWeight;
      
      // 2. Aplicar ajuste de tendência baseado em múltiplas MAs
      const trendStrength = Math.abs(trendScore) / 4; // 0 a 1
      const trendAdjustment = atr * trendStrength * 0.5;
      
      if (trend === 'bullish') {
        predictedClose += trendAdjustment;
      } else if (trend === 'bearish') {
        predictedClose -= trendAdjustment;
      }
      
      // 3. Ajuste baseado em RSI (sobrecompra/sobrevenda)
      if (rsi > 70) {
        // Sobrecompra - possível correção para baixo
        predictedClose -= atr * 0.2;
      } else if (rsi < 30) {
        // Sobrevenda - possível recuperação
        predictedClose += atr * 0.2;
      }
      
      // 4. Ajuste baseado em volume (volume alto = movimento mais confiável)
      const volumeWeight = Math.min(volumeRatio, 2) / 2; // 0 a 1
      const volumeAdjustment = (predictedClose - currentPrice.price) * volumeWeight;
      predictedClose = currentPrice.price + volumeAdjustment;
      
      // 5. SUAVIZAÇÃO PROGRESSIVA (evita mudanças bruscas)
      const cacheKey = `${normalizedSymbol}_${timeframe}`;
      const previousPrediction = this.predictionCache.get(cacheKey);
      
      if (previousPrediction) {
        // Fatores de suavização baseados no timeframe
        const smoothingFactors = { '1m': 0.3, '15m': 0.5, '1h': 0.7, '4h': 0.85 };
        const smoothingFactor = smoothingFactors[timeframe];
        
        // Média ponderada entre previsão anterior e nova
        predictedClose = previousPrediction * smoothingFactor + predictedClose * (1 - smoothingFactor);
      }
      
      // Atualizar cache
      this.predictionCache.set(cacheKey, predictedClose);
      
      // 6. Limitar variação máxima baseada na volatilidade
      const maxChange = atr * 2; // Máximo 2x ATR de variação
      const change = predictedClose - currentPrice.price;
      if (Math.abs(change) > maxChange) {
        predictedClose = currentPrice.price + (change > 0 ? maxChange : -maxChange);
      }
      
      // Calcular confiança baseada em múltiplos fatores
      const trendConsistency = trendStrength * 25; // 0-25 pontos
      const volumeConfidence = Math.min(volumeRatio * 15, 20); // 0-20 pontos
      const volatilityConfidence = (1 - Math.min(volatilityPercent / 0.05, 1)) * 25; // 0-25 pontos
      const rsiConfidence = (rsi > 30 && rsi < 70) ? 15 : 5; // 5-15 pontos
      const maAlignment = (Math.abs(trendScore) / 4) * 15; // 0-15 pontos
      
      const confidence = Math.min(
        trendConsistency + volumeConfidence + volatilityConfidence + rsiConfidence + maAlignment,
        95
      );
      
      // Calcular tempo restante até fechar o candle
      const timeframeMinutes = {
        '1m': 1,
        '15m': 15,
        '1h': 60,
        '4h': 240
      }[timeframe];
      
      const now = Date.now();
      const candleStartTime = Math.floor(now / (timeframeMinutes * 60 * 1000)) * (timeframeMinutes * 60 * 1000);
      const candleEndTime = candleStartTime + (timeframeMinutes * 60 * 1000);
      const timeRemaining = Math.floor((candleEndTime - now) / 1000);
      
      return {
        timeframe,
        predictedClose: Math.max(predictedClose, 0),
        previousClose,
        recentPrices,
        confidence: Math.round(confidence),
        timeRemaining: Math.max(timeRemaining, 0),
        currentTrend: trend,
      };
    } catch (error) {
      console.error(`Erro ao calcular previsão para ${timeframe}:`, error);
      
      // Retornar previsão básica em caso de erro
      const marketData = await this.getMarketData(symbol);
      return {
        timeframe,
        predictedClose: marketData.price,
        previousClose: marketData.price,
        recentPrices: [marketData.price],
        confidence: 50,
        timeRemaining: 0,
        currentTrend: 'neutral',
      };
    }
  }
  
  // Calcular média móvel simples
  private calculateMA(candles: Candle[], period: number): number {
    const slice = candles.slice(0, Math.min(period, candles.length));
    return slice.reduce((sum, c) => sum + c.close, 0) / slice.length;
  }
  
  // Calcular média móvel exponencial
  private calculateEMA(candles: Candle[], period: number): number {
    if (candles.length < period) return this.calculateMA(candles, candles.length);
    
    const multiplier = 2 / (period + 1);
    let ema = this.calculateMA(candles.slice(-period), period);
    
    for (let i = candles.length - period - 1; i >= 0; i--) {
      ema = (candles[i].close - ema) * multiplier + ema;
    }
    
    return ema;
  }
  
  // Calcular ATR (Average True Range)
  private calculateATR(candles: Candle[], period: number): number {
    if (candles.length < period + 1) return 0;
    
    const trueRanges: number[] = [];
    
    for (let i = 0; i < Math.min(period, candles.length - 1); i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i + 1].close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      
      trueRanges.push(tr);
    }
    
    return trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
  }
  
  // Calcular RSI (Relative Strength Index)
  private calculateRSI(candles: Candle[], period: number): number {
    if (candles.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 0; i < period; i++) {
      const change = candles[i].close - candles[i + 1].close;
      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  // Executar ordem (autenticado)
  async placeOrder(
    symbol: string,
    side: OrderSide,
    amount: number,
    price?: number,
    stopLoss?: number,
    takeProfit?: number
  ): Promise<Trade> {
    // Normalizar símbolo
    const normalizedSymbol = symbol.includes('-') ? symbol : this.normalizeSymbol(symbol);
    
    if (this.isDryRun || !this.apiKey || !this.secretKey) {
      // Modo DRY RUN - simular ordem
      const marketData = await this.getMarketData(normalizedSymbol);
      const executionPrice = price || marketData.price;
      
      return {
        id: `DRY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        symbol: normalizedSymbol,
        side,
        type: price ? 'limit' : 'market',
        price: executionPrice,
        amount,
        total: executionPrice * amount,
        mode: 'DRY_RUN',
        status: 'executed',
        reason: 'Ordem simulada em modo DRY RUN',
        stopLoss,
        takeProfit,
      };
    }

    // Modo LIVE - executar ordem real
    try {
      const requestPath = '/api/v5/trade/order';
      
      const orderData = {
        instId: normalizedSymbol,
        tdMode: 'cash',
        side,
        ordType: price ? 'limit' : 'market',
        sz: amount.toString(),
        ...(price && { px: price.toString() }),
      };

      const body = JSON.stringify(orderData);
      const headers = await this.getHeaders('POST', requestPath, body);

      const response = await fetch(`${this.baseUrl}${requestPath}`, {
        method: 'POST',
        headers,
        body,
      });

      const data = await response.json();

      if (data.code !== '0') {
        throw new Error(data.msg || 'Erro ao executar ordem');
      }

      const orderResult = data.data[0];
      const executionPrice = price || parseFloat(orderResult.fillPx || '0');

      // Configurar stop loss e take profit se fornecidos
      if (stopLoss || takeProfit) {
        await this.setStopLossTakeProfit(orderResult.ordId, stopLoss, takeProfit);
      }

      return {
        id: orderResult.ordId,
        timestamp: Date.now(),
        symbol: normalizedSymbol,
        side,
        type: price ? 'limit' : 'market',
        price: executionPrice,
        amount,
        total: executionPrice * amount,
        mode: 'LIVE',
        status: 'executed',
        stopLoss,
        takeProfit,
      };
    } catch (error) {
      console.error('Erro ao executar ordem:', error);
      throw error;
    }
  }

  // Configurar stop loss e take profit
  private async setStopLossTakeProfit(
    orderId: string,
    stopLoss?: number,
    takeProfit?: number
  ): Promise<void> {
    if (this.isDryRun) return;

    try {
      const requestPath = '/api/v5/trade/order-algo';
      
      const orders = [];
      
      if (stopLoss) {
        orders.push({
          instId: orderId,
          ordType: 'conditional',
          side: 'sell',
          triggerPx: stopLoss.toString(),
          orderPx: '-1',
          sz: '1',
        });
      }
      
      if (takeProfit) {
        orders.push({
          instId: orderId,
          ordType: 'conditional',
          side: 'sell',
          triggerPx: takeProfit.toString(),
          orderPx: '-1',
          sz: '1',
        });
      }

      for (const order of orders) {
        const body = JSON.stringify(order);
        const headers = await this.getHeaders('POST', requestPath, body);

        await fetch(`${this.baseUrl}${requestPath}`, {
          method: 'POST',
          headers,
          body,
        });
      }
    } catch (error) {
      console.error('Erro ao configurar stop loss/take profit:', error);
    }
  }

  // Obter saldo da conta (autenticado)
  async getBalance(): Promise<AccountBalance> {
    if (this.isDryRun || !this.apiKey || !this.secretKey) {
      return {
        totalEquity: 10000,
        availableBalance: 10000,
        currency: 'USDT',
        positions: {},
      };
    }

    try {
      const requestPath = '/api/v5/account/balance';
      const headers = await this.getHeaders('GET', requestPath);

      const response = await fetch(`${this.baseUrl}${requestPath}`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (data.code !== '0') {
        throw new Error(data.msg || 'Erro ao obter saldo');
      }

      const accountData = data.data[0];
      const details = accountData.details || [];
      
      const positions: { [symbol: string]: any } = {};
      details.forEach((detail: any) => {
        if (parseFloat(detail.availBal) > 0) {
          positions[detail.ccy] = {
            amount: parseFloat(detail.availBal),
            avgPrice: parseFloat(detail.avgPx || '0'),
            currentValue: parseFloat(detail.eqUsd || '0'),
          };
        }
      });

      return {
        totalEquity: parseFloat(accountData.totalEq || '0'),
        availableBalance: parseFloat(accountData.availBal || '0'),
        currency: 'USDT',
        positions,
      };
    } catch (error) {
      console.error('Erro ao obter saldo:', error);
      throw error;
    }
  }

  // Obter posição atual de um ativo
  async getPosition(symbol: string): Promise<{ amount: number; avgPrice: number } | null> {
    if (this.isDryRun) {
      return null;
    }

    try {
      const normalizedSymbol = symbol.includes('-') ? symbol : this.normalizeSymbol(symbol);
      const requestPath = `/api/v5/account/positions?instId=${normalizedSymbol}`;
      const headers = await this.getHeaders('GET', requestPath);

      const response = await fetch(`${this.baseUrl}${requestPath}`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (data.code !== '0' || !data.data || data.data.length === 0) {
        return null;
      }

      const position = data.data[0];
      return {
        amount: parseFloat(position.pos || '0'),
        avgPrice: parseFloat(position.avgPx || '0'),
      };
    } catch (error) {
      console.error('Erro ao obter posição:', error);
      return null;
    }
  }
}
