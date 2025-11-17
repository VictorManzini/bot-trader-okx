// Gerenciamento de Local Storage para o bot trader

import { ApiCredentials, BotConfig, Trade, TradingMode } from '@/types/trading';

const STORAGE_KEYS = {
  API_CREDENTIALS: 'okx_api_credentials',
  BOT_CONFIG: 'okx_bot_config',
  TRADE_HISTORY: 'okx_trade_history',
  BOT_STATUS: 'okx_bot_status',
};

// Configuração padrão do bot
export const DEFAULT_BOT_CONFIG: BotConfig = {
  mode: 'DRY_RUN' as TradingMode,
  symbol: 'BTC-USDT',
  interval: '5m',
  strategy: 'SHORT_TERM',
  rsiPeriod: 14,
  rsiOverbought: 70,
  rsiOversold: 30,
  maPeriod: 20,
  emaPeriod: 12,
  bollingerPeriod: 20,
  bollingerStdDev: 2,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  atrPeriod: 14,
  stopLossPercent: 2,
  takeProfitPercent: 3,
  tradeAmount: 100,
  riskPercentage: 1,
  dryRunBalance: 10000, // Patrimônio padrão para DRY RUN
};

// API Credentials
export const saveApiCredentials = (credentials: ApiCredentials): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.API_CREDENTIALS, JSON.stringify(credentials));
};

export const getApiCredentials = (): ApiCredentials | null => {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(STORAGE_KEYS.API_CREDENTIALS);
  return data ? JSON.parse(data) : null;
};

export const clearApiCredentials = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.API_CREDENTIALS);
};

// Bot Config
export const saveBotConfig = (config: BotConfig): void => {
  if (typeof window === 'undefined') return;
  // Garantir que dryRunBalance seja salvo corretamente
  const configToSave = {
    ...config,
    dryRunBalance: config.dryRunBalance || 10000, // Garantir valor padrão
  };
  localStorage.setItem(STORAGE_KEYS.BOT_CONFIG, JSON.stringify(configToSave));
};

export const getBotConfig = (): BotConfig => {
  if (typeof window === 'undefined') return DEFAULT_BOT_CONFIG;
  const data = localStorage.getItem(STORAGE_KEYS.BOT_CONFIG);
  if (!data) return DEFAULT_BOT_CONFIG;
  
  const savedConfig = JSON.parse(data);
  // Garantir que dryRunBalance esteja presente
  return {
    ...DEFAULT_BOT_CONFIG,
    ...savedConfig,
    dryRunBalance: savedConfig.dryRunBalance || 10000,
  };
};

// Trade History
export const saveTradeToHistory = (trade: Trade): void => {
  if (typeof window === 'undefined') return;
  const history = getTradeHistory();
  history.unshift(trade);
  // Manter apenas os últimos 100 trades
  const limitedHistory = history.slice(0, 100);
  localStorage.setItem(STORAGE_KEYS.TRADE_HISTORY, JSON.stringify(limitedHistory));
};

export const getTradeHistory = (): Trade[] => {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.TRADE_HISTORY);
  return data ? JSON.parse(data) : [];
};

export const clearTradeHistory = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.TRADE_HISTORY);
};

// Bot Status
export const saveBotStatus = (status: any): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.BOT_STATUS, JSON.stringify(status));
};

export const getBotStatus = (): any => {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(STORAGE_KEYS.BOT_STATUS);
  return data ? JSON.parse(data) : null;
};

export const clearAllData = (): void => {
  if (typeof window === 'undefined') return;
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
};
