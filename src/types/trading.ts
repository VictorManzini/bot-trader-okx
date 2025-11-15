// Tipos para o bot trader OKX

export type TradingMode = 'DRY_RUN' | 'LIVE';

export type OrderSide = 'buy' | 'sell';

export type OrderType = 'market' | 'limit' | 'stop_loss' | 'take_profit';

export type TradingStrategy = 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM';

export interface ApiCredentials {
  apiKey: string;
  secretKey: string;
  passphrase: string;
}

export interface BotConfig {
  mode: TradingMode;
  symbol: string;
  interval: string;
  strategy: TradingStrategy;
  rsiPeriod: number;
  rsiOverbought: number;
  rsiOversold: number;
  maPeriod: number;
  emaPeriod: number;
  bollingerPeriod: number;
  bollingerStdDev: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  atrPeriod: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  tradeAmount: number;
  riskPercentage: number; // Percentual do patrimônio a arriscar por trade
  dryRunBalance?: number; // Patrimônio inicial para modo DRY RUN
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Trade {
  id: string;
  timestamp: number;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: number;
  amount: number;
  total: number;
  mode: TradingMode;
  status: 'pending' | 'executed' | 'failed';
  reason?: string;
  stopLoss?: number;
  takeProfit?: number;
}

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}

export interface TradingSignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  reason: string;
  rsi: number;
  ma: number;
  ema: number;
  currentPrice: number;
  confidence: number;
  indicators: {
    bollinger?: { upper: number; middle: number; lower: number };
    macd?: { macd: number; signal: number; histogram: number };
    atr?: number;
  };
}

export interface BotStatus {
  isRunning: boolean;
  lastUpdate: number;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalProfit: number;
  currentPosition?: {
    side: OrderSide;
    entryPrice: number;
    amount: number;
    currentPrice: number;
    pnl: number;
    stopLoss: number;
    takeProfit: number;
  };
}

export interface AccountBalance {
  totalEquity: number;
  availableBalance: number;
  currency: string;
  positions: {
    [symbol: string]: {
      amount: number;
      avgPrice: number;
      currentValue: number;
    };
  };
}

export interface DynamicIndicatorConfig {
  strategy: TradingStrategy;
  rsiPeriod: number;
  maPeriod: number;
  emaPeriod: number;
  bollingerPeriod: number;
  bollingerStdDev: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  atrPeriod: number;
  volatility: number;
  performance: number;
}

export interface TradingPair {
  instId: string;
  baseCcy: string;
  quoteCcy: string;
  instType: string;
  state: string;
}
