'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Settings, TrendingUp, TrendingDown, Activity, DollarSign, AlertCircle, CheckCircle, XCircle, Info, ChevronDown, Search } from 'lucide-react';
import { OKXApiClient, TradingPair } from '@/lib/okx-api';
import { 
  generateTradingSignal, 
  getDynamicIndicatorConfig,
  calculateAutoTradeAmount,
  shouldClosePosition,
  calculateATR 
} from '@/lib/trading-logic';
import { 
  saveApiCredentials, 
  getApiCredentials, 
  saveBotConfig, 
  getBotConfig, 
  saveTradeToHistory, 
  getTradeHistory,
  DEFAULT_BOT_CONFIG 
} from '@/lib/storage';
import { ApiCredentials, BotConfig, Trade, MarketData, BotStatus, TradingSignal, AccountBalance } from '@/types/trading';

export default function TradingBotPage() {
  // Estado de montagem para evitar hydration mismatch
  const [mounted, setMounted] = useState(false);

  // Estados principais
  const [isConfigured, setIsConfigured] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  
  // Configurações - inicializadas com valores padrão
  const [credentials, setCredentials] = useState<ApiCredentials>({
    apiKey: '',
    secretKey: '',
    passphrase: '',
  });
  const [config, setConfig] = useState<BotConfig>(DEFAULT_BOT_CONFIG);
  
  // Estados para lista de pares
  const [tradingPairs, setTradingPairs] = useState<TradingPair[]>([]);
  const [showPairDropdown, setShowPairDropdown] = useState(false);
  const [pairSearchTerm, setPairSearchTerm] = useState('');
  const [loadingPairs, setLoadingPairs] = useState(false);
  
  // Dados de mercado
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [price24hAgo, setPrice24hAgo] = useState<number | null>(null);
  const [signal, setSignal] = useState<TradingSignal | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accountBalance, setAccountBalance] = useState<AccountBalance | null>(null);
  const [autoTradeInfo, setAutoTradeInfo] = useState<string>('');
  const [botStatus, setBotStatus] = useState<BotStatus>({
    isRunning: false,
    lastUpdate: Date.now(),
    totalTrades: 0,
    successfulTrades: 0,
    failedTrades: 0,
    totalProfit: 0,
  });

  // Cliente API - usar ref para manter referência estável
  const apiClientRef = useRef<OKXApiClient | null>(null);

  // Efeito de montagem
  useEffect(() => {
    setMounted(true);
  }, []);

  // Carregar dados salvos
  useEffect(() => {
    if (!mounted) return;

    const savedCredentials = getApiCredentials();
    const savedConfig = getBotConfig();
    const savedTrades = getTradeHistory();

    if (savedCredentials) {
      setCredentials(savedCredentials);
      setIsConfigured(true);
      apiClientRef.current = new OKXApiClient(savedCredentials, savedConfig.mode === 'DRY_RUN');
    }
    
    setConfig(savedConfig);
    setTrades(savedTrades);
  }, [mounted]);

  // Carregar pares de trading disponíveis
  useEffect(() => {
    if (!mounted || !apiClientRef.current) return;
    
    const loadTradingPairs = async () => {
      setLoadingPairs(true);
      try {
        const pairs = await apiClientRef.current!.getTradingPairs();
        setTradingPairs(pairs);
      } catch (error) {
        console.error('Erro ao carregar pares de trading:', error);
      } finally {
        setLoadingPairs(false);
      }
    };

    loadTradingPairs();
  }, [mounted, isConfigured]);

  // Filtrar pares baseado na busca
  const filteredPairs = tradingPairs.filter(pair => 
    pair.instId.toLowerCase().includes(pairSearchTerm.toLowerCase()) ||
    pair.baseCcy.toLowerCase().includes(pairSearchTerm.toLowerCase()) ||
    pair.quoteCcy.toLowerCase().includes(pairSearchTerm.toLowerCase())
  );

  // Calcular desempenho recente (últimas 10 trades)
  const calculateRecentPerformance = (): number => {
    const recentTrades = trades.slice(0, 10);
    if (recentTrades.length === 0) return 0;

    let totalPnL = 0;
    for (let i = 0; i < recentTrades.length - 1; i += 2) {
      const entry = recentTrades[i + 1];
      const exit = recentTrades[i];
      
      if (entry && exit) {
        const pnl = entry.side === 'buy'
          ? (exit.price - entry.price) * entry.amount
          : (entry.price - exit.price) * entry.amount;
        totalPnL += pnl;
      }
    }

    const avgPnL = totalPnL / (recentTrades.length / 2);
    return (avgPnL / (accountBalance?.totalEquity || 10000)) * 100;
  };

  // Atualizar dados de mercado
  const updateMarketData = async () => {
    const apiClient = apiClientRef.current;
    if (!apiClient) return;

    try {
      // Obter dados de mercado em tempo real
      const data = await apiClient.getMarketData(config.symbol);
      setMarketData(data);

      // Obter saldo da conta (com patrimônio configurável em DRY RUN)
      let balance = await apiClient.getBalance();
      
      // Se estiver em DRY RUN e houver patrimônio configurado, usar esse valor
      if (config.mode === 'DRY_RUN' && config.dryRunBalance) {
        balance = {
          ...balance,
          totalEquity: config.dryRunBalance,
          availableBalance: config.dryRunBalance,
        };
      }
      
      setAccountBalance(balance);

      // Obter candles para análise
      const candles = await apiClient.getCandles(config.symbol, config.interval, 100);
      
      // Calcular preço de 24h atrás (288 candles de 5min = 24h)
      const candles24h = await apiClient.getCandles(config.symbol, config.interval, 288);
      if (candles24h.length > 0) {
        setPrice24hAgo(candles24h[candles24h.length - 1].close);
      }
      
      // Calcular desempenho recente
      const recentPerformance = calculateRecentPerformance();

      // Obter configuração dinâmica de indicadores
      const dynamicConfig = getDynamicIndicatorConfig(
        config.strategy,
        candles,
        recentPerformance
      );

      // Gerar sinal de trading com indicadores dinâmicos
      const tradingSignal = generateTradingSignal(candles, dynamicConfig);
      
      setSignal(tradingSignal);

      // Executar trading automático se bot estiver rodando
      if (isRunning && tradingSignal.confidence >= 70) {
        await executeTrade(tradingSignal, candles, balance, dynamicConfig);
      }

      // Verificar posição aberta
      if (botStatus.currentPosition) {
        await checkPosition(data.price, candles, balance);
      }
    } catch (error) {
      console.error('Erro ao atualizar dados:', error);
    }
  };

  // Executar trade baseado no sinal
  const executeTrade = async (
    signal: TradingSignal, 
    candles: any[], 
    balance: AccountBalance,
    dynamicConfig: any
  ) => {
    const apiClient = apiClientRef.current;
    if (!apiClient || signal.action === 'HOLD') return;

    try {
      const side = signal.action === 'BUY' ? 'buy' : 'sell';
      
      // Calcular ATR para stop loss/take profit dinâmicos
      const atr = calculateATR(candles, dynamicConfig.atrPeriod);
      
      // CÁLCULO AUTOMÁTICO DO VALOR POR TRADE
      const autoCalculation = calculateAutoTradeAmount(
        signal.currentPrice,
        side,
        balance,
        config.strategy,
        atr,
        config.riskPercentage,
        signal
      );

      // Salvar informações do cálculo automático
      setAutoTradeInfo(autoCalculation.reasoning);

      const trade = await apiClient.placeOrder(
        config.symbol,
        side,
        autoCalculation.tradeAmount,
        undefined,
        autoCalculation.stopLoss,
        autoCalculation.takeProfit
      );

      // Atualizar status do bot
      setBotStatus(prev => ({
        ...prev,
        totalTrades: prev.totalTrades + 1,
        successfulTrades: prev.successfulTrades + 1,
        currentPosition: {
          side,
          entryPrice: trade.price,
          amount: trade.amount,
          currentPrice: trade.price,
          pnl: 0,
          stopLoss: autoCalculation.stopLoss,
          takeProfit: autoCalculation.takeProfit,
        },
      }));

      // Salvar trade
      saveTradeToHistory(trade);
      setTrades(prev => [trade, ...prev]);
    } catch (error) {
      console.error('Erro ao executar trade:', error);
      setBotStatus(prev => ({
        ...prev,
        failedTrades: prev.failedTrades + 1,
      }));
    }
  };

  // Verificar posição aberta
  const checkPosition = async (currentPrice: number, candles: any[], balance: AccountBalance) => {
    const apiClient = apiClientRef.current;
    if (!botStatus.currentPosition || !apiClient) return;

    const { side, entryPrice, amount, stopLoss, takeProfit } = botStatus.currentPosition;

    const { shouldClose, reason } = shouldClosePosition(
      currentPrice,
      entryPrice,
      side,
      stopLoss,
      takeProfit
    );

    if (shouldClose) {
      try {
        const closeSide = side === 'buy' ? 'sell' : 'buy';
        const trade = await apiClient.placeOrder(
          config.symbol,
          closeSide,
          amount
        );

        // Calcular lucro/prejuízo
        const pnl = side === 'buy' 
          ? (currentPrice - entryPrice) * amount
          : (entryPrice - currentPrice) * amount;

        setBotStatus(prev => ({
          ...prev,
          totalProfit: prev.totalProfit + pnl,
          currentPosition: undefined,
        }));

        trade.reason = reason;
        saveTradeToHistory(trade);
        setTrades(prev => [trade, ...prev]);
      } catch (error) {
        console.error('Erro ao fechar posição:', error);
      }
    } else {
      // Atualizar PnL da posição
      const pnl = side === 'buy'
        ? (currentPrice - entryPrice) * amount
        : (entryPrice - currentPrice) * amount;

      setBotStatus(prev => ({
        ...prev,
        currentPosition: prev.currentPosition ? {
          ...prev.currentPosition,
          currentPrice,
          pnl,
        } : undefined,
      }));
    }
  };

  // Atualizar dados periodicamente - atualização a cada 10 segundos
  useEffect(() => {
    if (!isConfigured || !apiClientRef.current || !mounted) return;

    // Primeira atualização imediata
    updateMarketData();
    
    // Configurar intervalo de 10 segundos
    const interval = setInterval(() => {
      updateMarketData();
    }, 10000);

    return () => clearInterval(interval);
  }, [isConfigured, mounted, config.symbol, config.interval, config.mode, config.dryRunBalance]);

  // Salvar configurações - atualiza patrimônio imediatamente
  const handleSaveConfig = async () => {
    // Salvar configurações
    saveApiCredentials(credentials);
    saveBotConfig(config);
    
    // Recriar cliente API com novo modo
    apiClientRef.current = new OKXApiClient(credentials, config.mode === 'DRY_RUN');
    
    setIsConfigured(true);
    setShowConfig(false);
    
    // Atualizar dados imediatamente para refletir mudanças
    setTimeout(() => {
      updateMarketData();
    }, 100);
  };

  // Toggle bot
  const toggleBot = () => {
    setIsRunning(!isRunning);
    setBotStatus(prev => ({ ...prev, isRunning: !isRunning }));
  };

  // Calcular variação percentual com base no preço de 24h atrás
  const calculateChange24h = (): number => {
    if (!marketData || !price24hAgo || price24hAgo === 0) return 0;
    return ((marketData.price - price24hAgo) / price24hAgo) * 100;
  };

  // Renderizar apenas após montagem
  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                OKX Trading Bot
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  config.mode === 'DRY_RUN' 
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' 
                    : 'bg-green-500/20 text-green-400 border border-green-500/50'
                }`}>
                  {config.mode === 'DRY_RUN' ? '🧪 DRY RUN' : '🔴 LIVE'}
                </div>
                <span className="text-sm text-slate-400">
                  Estratégia: <span className="text-cyan-400">{config.strategy?.replace('_', ' ') || 'N/A'}</span>
                </span>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" />
                <span className="sm:inline">Configurar</span>
              </button>
              {isConfigured && (
                <button
                  onClick={toggleBot}
                  className={`flex-1 sm:flex-none px-6 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                    isRunning
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700'
                  }`}
                >
                  {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isRunning ? 'Pausar' : 'Iniciar'}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-8">
        {/* Configuração */}
        {showConfig && (
          <div className="mb-6 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-4 sm:p-6">
            <h2 className="text-xl font-bold mb-4">Configurações</h2>
            
            {/* API Credentials */}
            <div className="space-y-4 mb-6">
              <h3 className="text-sm font-semibold text-slate-400 uppercase">Credenciais API OKX</h3>
              <input
                type="text"
                placeholder="API Key"
                value={credentials.apiKey || ''}
                onChange={(e) => setCredentials({ ...credentials, apiKey: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-cyan-500"
              />
              <input
                type="password"
                placeholder="Secret Key"
                value={credentials.secretKey || ''}
                onChange={(e) => setCredentials({ ...credentials, secretKey: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-cyan-500"
              />
              <input
                type="password"
                placeholder="Passphrase"
                value={credentials.passphrase || ''}
                onChange={(e) => setCredentials({ ...credentials, passphrase: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Bot Config */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Modo</label>
                <select
                  value={config.mode || 'DRY_RUN'}
                  onChange={(e) => setConfig({ ...config, mode: e.target.value as 'DRY_RUN' | 'LIVE' })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-cyan-500"
                >
                  <option value="DRY_RUN">DRY RUN (Simulação)</option>
                  <option value="LIVE">LIVE (Real)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Estratégia</label>
                <select
                  value={config.strategy || 'SHORT_TERM'}
                  onChange={(e) => setConfig({ ...config, strategy: e.target.value as any })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-cyan-500"
                >
                  <option value="SHORT_TERM">Curto Prazo</option>
                  <option value="MEDIUM_TERM">Médio Prazo</option>
                  <option value="LONG_TERM">Longo Prazo</option>
                </select>
              </div>
              
              {/* Seletor de Par com Dropdown */}
              <div className="sm:col-span-2">
                <label className="block text-sm text-slate-400 mb-2">Par de Trading</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowPairDropdown(!showPairDropdown)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-cyan-500 flex items-center justify-between text-left"
                  >
                    <span>{config.symbol || 'Selecione um par'}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showPairDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showPairDropdown && (
                    <div className="absolute z-10 w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-96 overflow-hidden">
                      {/* Campo de busca */}
                      <div className="p-3 border-b border-slate-700">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Buscar par (ex: BTC, ETH, SOL)..."
                            value={pairSearchTerm}
                            onChange={(e) => setPairSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:outline-none focus:border-cyan-500 text-sm"
                          />
                        </div>
                      </div>
                      
                      {/* Lista de pares */}
                      <div className="overflow-y-auto max-h-80">
                        {loadingPairs ? (
                          <div className="p-4 text-center text-slate-400">
                            <Activity className="w-5 h-5 animate-spin mx-auto mb-2" />
                            Carregando pares...
                          </div>
                        ) : filteredPairs.length === 0 ? (
                          <div className="p-4 text-center text-slate-400">
                            Nenhum par encontrado
                          </div>
                        ) : (
                          filteredPairs.map((pair) => (
                            <button
                              key={pair.instId}
                              type="button"
                              onClick={() => {
                                setConfig({ ...config, symbol: pair.instId });
                                setShowPairDropdown(false);
                                setPairSearchTerm('');
                              }}
                              className={`w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-b-0 ${
                                config.symbol === pair.instId ? 'bg-cyan-900/30 text-cyan-400' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-semibold">{pair.instId}</div>
                                  <div className="text-xs text-slate-400">
                                    {pair.baseCcy} / {pair.quoteCcy}
                                  </div>
                                </div>
                                {config.symbol === pair.instId && (
                                  <CheckCircle className="w-4 h-4 text-cyan-400" />
                                )}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Risco por Trade (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={config.riskPercentage || 1}
                  onChange={(e) => setConfig({ ...config, riskPercentage: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-cyan-500"
                />
              </div>
              {config.mode === 'DRY_RUN' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Patrimônio Inicial (DRY RUN) - USD
                  </label>
                  <input
                    type="number"
                    step="100"
                    value={config.dryRunBalance || 10000}
                    onChange={(e) => setConfig({ ...config, dryRunBalance: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-cyan-500"
                    placeholder="10000"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Configure o valor inicial para simulação (padrão: $10,000)
                  </p>
                </div>
              )}
            </div>

            <div className="bg-gradient-to-r from-cyan-950/30 to-blue-950/30 border border-cyan-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-cyan-300">
                  <strong className="block mb-2">🤖 Cálculo Automático Ativado</strong>
                  <p className="mb-2">
                    O bot calcula automaticamente o <strong>valor por trade</strong> considerando:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Estratégia atual (curto, médio ou longo prazo)</li>
                    <li>Níveis de Stop Loss e Take Profit (baseados em ATR)</li>
                    <li>Volatilidade do mercado (ATR dinâmico)</li>
                    <li>Patrimônio disponível na sua conta OKX</li>
                    <li>Confiança do sinal de trading</li>
                    <li>Desempenho recente das operações</li>
                  </ul>
                  <p className="mt-2 text-cyan-200">
                    ✨ O valor é recalculado dinamicamente a cada nova oportunidade!
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveConfig}
              className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 rounded-lg font-semibold transition-all"
            >
              Salvar Configurações
            </button>
          </div>
        )}

        {!isConfigured ? (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
            <h2 className="text-2xl font-bold mb-2">Configure o Bot</h2>
            <p className="text-slate-400 mb-6">
              Adicione suas credenciais da API OKX para começar
            </p>
            <button
              onClick={() => setShowConfig(true)}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 rounded-lg font-semibold transition-all"
            >
              Configurar Agora
            </button>
          </div>
        ) : (
          <>
            {/* Dashboard Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Preço Atual */}
              <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Preço Atual</span>
                  <DollarSign className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-bold">
                  ${marketData?.price?.toFixed(2) || '0.00'}
                </div>
                <div className={`text-sm mt-1 ${calculateChange24h() >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {calculateChange24h() >= 0 ? '+' : ''}{calculateChange24h().toFixed(2)}% (24h)
                </div>
              </div>

              {/* RSI */}
              <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">RSI (Dinâmico)</span>
                  <Activity className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-bold">
                  {signal?.rsi?.toFixed(2) || '0.00'}
                </div>
                <div className="text-sm mt-1 text-slate-400">
                  {signal && signal.rsi < 30 ? 'Sobrevenda' : 
                   signal && signal.rsi > 70 ? 'Sobrecompra' : 'Neutro'}
                </div>
              </div>

              {/* Total de Trades */}
              <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Total Trades</span>
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl font-bold">
                  {botStatus.totalTrades}
                </div>
                <div className="text-sm mt-1 text-green-400">
                  {botStatus.successfulTrades} sucesso
                </div>
              </div>

              {/* Lucro Total */}
              <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Lucro Total</span>
                  <TrendingDown className="w-4 h-4 text-emerald-400" />
                </div>
                <div className={`text-2xl font-bold ${botStatus.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${botStatus.totalProfit.toFixed(2)}
                </div>
                <div className="text-sm mt-1 text-slate-400">
                  {config.mode === 'DRY_RUN' ? 'Simulado' : 'Real'}
                </div>
              </div>
            </div>

            {/* Patrimônio */}
            {accountBalance && (
              <div className="mb-6 bg-gradient-to-r from-cyan-950/30 to-blue-950/30 border border-cyan-500/30 rounded-xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-cyan-300">Patrimônio Total</h3>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    config.mode === 'DRY_RUN' 
                      ? 'bg-yellow-500/20 text-yellow-400' 
                      : 'bg-green-500/20 text-green-400'
                  }`}>
                    {config.mode === 'DRY_RUN' ? 'SIMULAÇÃO' : 'REAL'}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-slate-400">Total</div>
                    <div className="text-xl font-bold text-cyan-300">
                      ${accountBalance.totalEquity.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400">Disponível</div>
                    <div className="text-xl font-bold">
                      ${accountBalance.availableBalance.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400">Risco/Trade</div>
                    <div className="text-xl font-bold text-yellow-400">
                      ${(accountBalance.totalEquity * (config.riskPercentage / 100)).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Informações do Cálculo Automático */}
            {autoTradeInfo && (
              <div className="mb-6 bg-gradient-to-r from-purple-950/30 to-pink-950/30 border border-purple-500/30 rounded-xl p-4 sm:p-6">
                <h3 className="text-lg font-bold mb-3 text-purple-300 flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Último Cálculo Automático
                </h3>
                <pre className="text-xs text-purple-200 whitespace-pre-wrap font-mono bg-slate-900/50 p-3 rounded-lg overflow-x-auto">
                  {autoTradeInfo}
                </pre>
              </div>
            )}

            {/* Sinal de Trading */}
            {signal && (
              <div className={`mb-6 p-4 sm:p-6 rounded-xl border-2 ${
                signal.action === 'BUY' ? 'bg-green-950/30 border-green-500' :
                signal.action === 'SELL' ? 'bg-red-950/30 border-red-500' :
                'bg-slate-900/50 border-slate-700'
              }`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {signal.action === 'BUY' ? (
                        <TrendingUp className="w-6 h-6 text-green-400" />
                      ) : signal.action === 'SELL' ? (
                        <TrendingDown className="w-6 h-6 text-red-400" />
                      ) : (
                        <Activity className="w-6 h-6 text-slate-400" />
                      )}
                      <span className="text-xl font-bold">
                        Sinal: {signal.action}
                      </span>
                    </div>
                    <p className="text-slate-300">{signal.reason}</p>
                    <div className="mt-2 text-sm text-slate-400">
                      Confiança: {signal.confidence}% | MA: ${signal.ma?.toFixed(2) || '0.00'} | EMA: ${signal.ema?.toFixed(2) || '0.00'}
                    </div>
                    {signal.indicators?.atr && (
                      <div className="mt-1 text-xs text-slate-500">
                        ATR: {signal.indicators.atr.toFixed(4)} (usado para SL/TP e cálculo de valor)
                      </div>
                    )}
                  </div>
                  {isRunning && signal.action !== 'HOLD' && (
                    <div className="flex items-center gap-2 text-sm text-cyan-400">
                      <Activity className="w-4 h-4 animate-pulse" />
                      Bot ativo
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Posição Atual */}
            {botStatus.currentPosition && (
              <div className="mb-6 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-4 sm:p-6">
                <h3 className="text-lg font-bold mb-4">Posição Aberta (Valor e SL/TP Automáticos)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div>
                    <div className="text-sm text-slate-400">Lado</div>
                    <div className={`font-semibold ${botStatus.currentPosition.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                      {botStatus.currentPosition.side.toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400">Entrada</div>
                    <div className="font-semibold">${botStatus.currentPosition.entryPrice.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400">Atual</div>
                    <div className="font-semibold">${botStatus.currentPosition.currentPrice.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400">Stop Loss</div>
                    <div className="font-semibold text-red-400">${botStatus.currentPosition.stopLoss.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400">Take Profit</div>
                    <div className="font-semibold text-green-400">${botStatus.currentPosition.takeProfit.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400">P&L</div>
                    <div className={`font-semibold ${botStatus.currentPosition.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${botStatus.currentPosition.pnl.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Histórico de Trades */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-4 sm:p-6">
              <h3 className="text-lg font-bold mb-4">Histórico de Operações</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {trades.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">Nenhuma operação ainda</p>
                ) : (
                  trades.map((trade) => (
                    <div
                      key={trade.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-slate-800/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {trade.status === 'executed' ? (
                          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                        ) : trade.status === 'failed' ? (
                          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                        ) : (
                          <Activity className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                        )}
                        <div>
                          <div className="font-semibold">
                            <span className={trade.side === 'buy' ? 'text-green-400' : 'text-red-400'}>
                              {trade.side.toUpperCase()}
                            </span>
                            {' '}{trade.symbol}
                          </div>
                          <div className="text-sm text-slate-400">
                            {new Date(trade.timestamp).toLocaleString('pt-BR')}
                          </div>
                          {trade.reason && (
                            <div className="text-xs text-slate-500 mt-1">{trade.reason}</div>
                          )}
                          {trade.stopLoss && trade.takeProfit && (
                            <div className="text-xs text-slate-500 mt-1">
                              SL: ${trade.stopLoss.toFixed(2)} | TP: ${trade.takeProfit.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-8 sm:ml-0">
                        <div className="font-semibold">${trade.price.toFixed(2)}</div>
                        <div className="text-sm text-slate-400">
                          {trade.amount.toFixed(6)} = ${trade.total.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
