// Cliente API OKX para trading

import { ApiCredentials, Candle, MarketData, OrderSide, Trade, AccountBalance } from '@/types/trading';

export interface TradingPair {
  instId: string;
  baseCcy: string;
  quoteCcy: string;
  instType: string;
  state: string;
}

export class OKXApiClient {
  private apiKey: string;
  private secretKey: string;
  private passphrase: string;
  private baseUrl = 'https://www.okx.com';
  private isDryRun: boolean;

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

  // Obter todos os pares de trading disponíveis na OKX
  async getTradingPairs(): Promise<TradingPair[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v5/public/instruments?instType=SPOT`,
        { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if (!response.ok) {
        console.warn(`Erro ao obter pares de trading: ${response.statusText}`);
        return this.getDefaultTradingPairs();
      }

      const data = await response.json();
      
      if (!data || data.code !== '0' || !data.data || !Array.isArray(data.data)) {
        console.warn('Resposta inválida ao obter pares de trading');
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
    } catch (error) {
      console.warn('Erro ao buscar pares de trading:', error);
      return this.getDefaultTradingPairs();
    }
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
    try {
      // Normalizar símbolo (BTC-USDT ou BTCUSDT -> BTC-USDT)
      const normalizedSymbol = symbol.includes('-') ? symbol : this.normalizeSymbol(symbol);
      
      const response = await fetch(
        `${this.baseUrl}/api/v5/market/ticker?instId=${normalizedSymbol}`,
        { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store' // Sempre buscar dados frescos
        }
      );
      
      if (!response.ok) {
        console.warn(`API OKX retornou erro: ${response.statusText}. Usando dados simulados.`);
        return this.getSimulatedMarketData(normalizedSymbol);
      }

      const data = await response.json();
      
      // Verificar se a resposta tem dados válidos
      if (!data || data.code !== '0' || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
        console.warn('Resposta da API OKX inválida. Usando dados simulados.');
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
    } catch (error) {
      console.warn('Erro ao obter dados de mercado da OKX:', error);
      console.log('Usando dados simulados para continuar operação.');
      return this.getSimulatedMarketData(symbol);
    }
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
    try {
      // Normalizar símbolo
      const normalizedSymbol = symbol.includes('-') ? symbol : this.normalizeSymbol(symbol);
      
      const response = await fetch(
        `${this.baseUrl}/api/v5/market/candles?instId=${normalizedSymbol}&bar=${interval}&limit=${limit}`,
        { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store'
        }
      );

      if (!response.ok) {
        console.warn(`API OKX retornou erro ao obter candles: ${response.statusText}. Usando dados simulados.`);
        return this.getSimulatedCandles(normalizedSymbol, limit);
      }

      const data = await response.json();
      
      if (!data || data.code !== '0' || !data.data || !Array.isArray(data.data)) {
        console.warn('Dados de candles inválidos. Usando dados simulados.');
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
    } catch (error) {
      console.warn('Erro ao obter candles da OKX:', error);
      console.log('Usando dados simulados para continuar operação.');
      return this.getSimulatedCandles(symbol, limit);
    }
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
