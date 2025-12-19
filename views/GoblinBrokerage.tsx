
import React, { useState, useEffect, useRef } from 'react';
import { ICONS } from '../constants';
import { brokerageService, StockTicker, PortfolioSummary, MarketStatus } from '../services/brokerageService';
import { watchlistService } from '../services/watchlistService'; // New import
import { goblinAdvisorService } from '../services/goblinAdvisorService';
import { yahooFinanceService, YahooChartPoint } from '../services/yahooFinanceService';
import { soundService } from '../services/soundService';
import { keyService } from '../services/keyService';
import WatchlistNewsPanel from '../components/WatchlistNewsPanel'; // New import
import { 
    TrendingUp, 
    TrendingDown, 
    ShieldAlert, 
    Swords, 
    Scroll, 
    Coins, 
    Search,
    RefreshCw,
    MessageSquare,
    Send,
    X,
    CheckCircle,
    Newspaper,
    ExternalLink,
    Loader2,
    ImageOff,
    Plus,
    WifiOff,
    Info,
    PieChart,
    Trash2
} from 'lucide-react';

// Tabs
type Tab = 'WAR_TABLE' | 'SCRYING_ORB' | 'TOWN_CRIER' | 'ARENA';

const GoblinBrokerage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState<Tab>('WAR_TABLE');
    const [watchlist, setWatchlist] = useState<StockTicker[]>([]);
    const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
    const [marketStatus, setMarketStatus] = useState<MarketStatus>('LOADING');
    
    // Search State
    const [tickerQuery, setTickerQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    
    // Chart / Detail State
    const [chartData, setChartData] = useState<YahooChartPoint[]>([]);
    const [selectedSymbol, setSelectedSymbol] = useState("SPY"); 
    const [chartLoading, setChartLoading] = useState(false);
    const [assetProfile, setAssetProfile] = useState<any>(null); 

    // Advisor Chat State
    const [chatInput, setChatInput] = useState("");
    const [advisorResponse, setAdvisorResponse] = useState<string | null>(null);
    const [isAdvising, setIsAdvising] = useState(false);

    // Trade Form State
    const [tradeQty, setTradeQty] = useState(1);
    const [tradeNote, setTradeNote] = useState("");
    const [tradeAction, setTradeAction] = useState<'BUY' | 'SELL'>('BUY');

    useEffect(() => {
        // Sync watchlistService state to local view
        const syncWatchlist = async () => {
             const symbols = watchlistService.getSymbols();
             // Ensure brokerage service is tracking these
             for(const sym of symbols) {
                 if (!brokerageService.getStockData(sym)) {
                     // Lazy load missing data
                     await brokerageService.addToWatchlist(sym).catch(() => {});
                 }
             }
             
             // Now fetch full objects
             const fullList = await brokerageService.getWatchlist();
             // Filter by what is currently in watchlistService to stay in sync
             const filtered = fullList.filter(s => watchlistService.hasSymbol(s.symbol));
             setWatchlist(filtered);
        };

        const refresh = async () => {
            await syncWatchlist();
            setPortfolio(await brokerageService.getPortfolio());
            setMarketStatus(brokerageService.getMarketStatus());
            
            if (!selectedSymbol && watchlist.length > 0) {
                setSelectedSymbol(watchlist[0].symbol);
            }
        };

        refresh();
        const unsubBroker = brokerageService.subscribe(refresh);
        const unsubWatch = watchlistService.subscribe(syncWatchlist);
        
        return () => {
            unsubBroker();
            unsubWatch();
        };
    }, []);

    // Effect to load chart/profile when symbol changes or tab changes
    useEffect(() => {
        if (activeTab === 'SCRYING_ORB' && selectedSymbol) {
            loadChart(selectedSymbol);
            loadProfile(selectedSymbol);
        }
    }, [activeTab, selectedSymbol]);

    const loadChart = async (symbol: string) => {
        setChartLoading(true);
        try {
            const points = await yahooFinanceService.getChart(symbol, '1d', '5m');
            setChartData(points);
        } catch (e) {
            console.error("Chart load failed", e);
        } finally {
            setChartLoading(false);
        }
    };
    
    const loadProfile = async (symbol: string) => {
        try {
            const profile = await yahooFinanceService.getAssetProfile(symbol);
            setAssetProfile(profile);
        } catch (e) {
            setAssetProfile(null);
        }
    };

    const handleSearchTicker = async () => {
        if (!tickerQuery) return;
        setIsSearching(true);
        try {
            const results = await yahooFinanceService.search(tickerQuery);
            if (results.length > 0) {
                const sym = results[0].symbol;
                // Update WatchlistService
                watchlistService.addSymbol(sym);
                // Also trigger Brokerage to fetch data immediately
                await brokerageService.addToWatchlist(sym);
                
                soundService.playQuestComplete();
                setTickerQuery("");
                setSelectedSymbol(sym); 
                alert(`Added ${sym} to Watchlist!`);
            } else {
                alert("Ticker not found in the archives.");
            }
        } catch (e: any) {
            alert(`Search Failed: ${e.message}`);
        } finally {
            setIsSearching(false);
        }
    };

    const handleTrade = async () => {
        try {
            const msg = await brokerageService.executeTrade(selectedSymbol, tradeAction, tradeQty, tradeNote);
            soundService.playQuestComplete(); 
            alert(msg);
            setTradeNote("");
        } catch (e: any) {
            soundService.playAlert();
            alert(e.message);
        }
    };

    const handleAskAdvisor = async () => {
        if (!chatInput.trim()) return;
        setIsAdvising(true);
        setAdvisorResponse(null);
        try {
            const advice = await goblinAdvisorService.getBeginnerGuidance(chatInput);
            setAdvisorResponse(advice);
            soundService.playWhisper();
        } catch (e) {
            setAdvisorResponse("The spirits are silent.");
        } finally {
            setIsAdvising(false);
        }
    };

    const handleRemoveFromWatchlist = (symbol: string) => {
        watchlistService.removeSymbol(symbol);
        brokerageService.removeFromWatchlist(symbol);
        soundService.playTrash();
    };
    
    const handleResetAccount = async () => {
        if(confirm("Reset all paper trades and cash?")) {
            await brokerageService.resetAccount();
            soundService.playTrash();
        }
    };

    // --- Sub-components ---

    const renderStatusBanner = () => {
        if (marketStatus === 'UNAVAILABLE' || marketStatus === 'ERROR') {
            return (
                <div className="bg-moncchichi-error/20 border border-moncchichi-error p-3 rounded-xl flex items-center gap-3 mb-4 animate-in slide-in-from-top-2">
                    <WifiOff className="text-moncchichi-error" size={20} />
                    <div className="flex-1">
                        <h4 className="text-xs font-bold text-moncchichi-error uppercase">Market Disconnected</h4>
                        <p className="text-[10px] text-moncchichi-text opacity-90">
                            Real-time pricing unavailable. Using last known values. Trades may fail.
                        </p>
                    </div>
                </div>
            );
        }
        return null;
    };

    const renderStockRow = (s: StockTicker, isWatchlist: boolean) => (
        <div 
            key={s.symbol} 
            onClick={() => { setSelectedSymbol(s.symbol); setActiveTab('SCRYING_ORB'); }}
            className={`bg-moncchichi-surface border border-moncchichi-border p-3 rounded-xl flex items-center justify-between mb-2 hover:bg-moncchichi-surfaceAlt transition-colors cursor-pointer ${selectedSymbol === s.symbol ? 'ring-1 ring-moncchichi-accent' : ''}`}
        >
            <div>
                <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-moncchichi-text">{s.symbol}</span>
                    {s.price > 0 && <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1 rounded uppercase tracking-wider">Real</span>}
                </div>
                <div className="text-[10px] text-moncchichi-textSec truncate max-w-[150px]">{s.name}</div>
            </div>
            <div className="flex items-center gap-4">
                <div className="text-right">
                    <div className="font-mono font-bold text-sm text-white">
                        {s.price > 0 ? `$${s.price.toFixed(2)}` : '--'}
                    </div>
                    <div className={`text-[10px] font-bold flex items-center justify-end gap-1 ${s.change >= 0 ? 'text-moncchichi-success' : 'text-moncchichi-error'}`}>
                        {s.change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {s.change > 0 ? '+' : ''}{s.change?.toFixed(2) || '0.00'}%
                    </div>
                </div>
                {isWatchlist && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleRemoveFromWatchlist(s.symbol); }}
                        className="p-2 rounded-full bg-moncchichi-error/10 text-moncchichi-error hover:bg-moncchichi-error/20"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>
        </div>
    );

    const renderWarTable = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            {renderStatusBanner()}
            
            {/* Search Bar */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <input 
                        type="text" 
                        value={tickerQuery}
                        onChange={(e) => setTickerQuery(e.target.value)}
                        placeholder="Add Ticker (e.g. MSFT, GME)"
                        className="w-full bg-moncchichi-surface border border-moncchichi-border rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-moncchichi-accent uppercase font-mono"
                        onKeyDown={e => e.key === 'Enter' && handleSearchTicker()}
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-moncchichi-textSec" size={16} />
                </div>
                <button 
                    onClick={handleSearchTicker}
                    disabled={isSearching}
                    className="bg-moncchichi-surfaceAlt border border-moncchichi-border text-moncchichi-text px-4 rounded-xl font-bold"
                >
                    {isSearching ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                </button>
            </div>

            <div>
                <h3 className="text-xs font-bold text-moncchichi-textSec uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Your Watchlist</span>
                    <span className="text-[10px] bg-moncchichi-surfaceAlt px-2 rounded-full">{watchlist.length}</span>
                </h3>
                {watchlist.length === 0 ? (
                    <div className="text-center py-12 text-moncchichi-textSec opacity-50 flex flex-col items-center gap-3">
                        <Search size={32} />
                        <span className="text-xs italic">The ledger is empty.<br/>Search above to track assets.</span>
                    </div>
                ) : (
                    watchlist.map(s => renderStockRow(s, true))
                )}
            </div>
        </div>
    );

    const renderScryingOrb = () => {
        // Simple SVG Chart
        const width = 300;
        const height = 150;
        
        let path = "";
        let color = "#34d399"; // Success

        if (chartData.length > 1) {
            const minPrice = Math.min(...chartData.map(d => d.close));
            const maxPrice = Math.max(...chartData.map(d => d.close));
            const range = maxPrice - minPrice;
            
            if (chartData[chartData.length - 1].close < chartData[0].close) color = "#f87171"; // Error

            path = "M " + chartData.map((d, i) => {
                const x = (i / (chartData.length - 1)) * width;
                const y = height - ((d.close - minPrice) / range) * height;
                return `${x} ${y}`;
            }).join(" L ");
        }
        
        const currentStock = watchlist.find(s => s.symbol === selectedSymbol) || { symbol: selectedSymbol, name: 'Unknown', price: 0, change: 0 };

        return (
            <div className="flex flex-col h-full animate-in zoom-in-95 space-y-4">
                 {/* Symbol Selector if navigating directly */}
                 <div className="flex overflow-x-auto gap-2 pb-1 no-scrollbar">
                     {watchlist.map(s => (
                         <button 
                             key={s.symbol}
                             onClick={() => setSelectedSymbol(s.symbol)}
                             className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${selectedSymbol === s.symbol ? 'bg-moncchichi-accent text-moncchichi-bg' : 'bg-moncchichi-surfaceAlt text-moncchichi-textSec'}`}
                         >
                             {s.symbol}
                         </button>
                     ))}
                 </div>

                 <div className="bg-moncchichi-surface border border-moncchichi-border rounded-xl p-4">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-moncchichi-text">{currentStock.symbol}</h2>
                            <div className="text-xs text-moncchichi-textSec">{currentStock.name}</div>
                            {assetProfile && (
                                <div className="flex gap-2 mt-1">
                                    <span className="text-[9px] bg-moncchichi-surfaceAlt px-1.5 py-0.5 rounded text-moncchichi-textSec border border-moncchichi-border">{assetProfile.sector || 'Sector'}</span>
                                    <span className="text-[9px] bg-moncchichi-surfaceAlt px-1.5 py-0.5 rounded text-moncchichi-textSec border border-moncchichi-border">{assetProfile.industry || 'Industry'}</span>
                                </div>
                            )}
                        </div>
                        <div className="text-right">
                             <div className="text-xl font-mono font-bold text-white">${currentStock.price.toFixed(2)}</div>
                             <div className={`text-xs font-bold ${currentStock.change >= 0 ? 'text-moncchichi-success' : 'text-moncchichi-error'}`}>
                                 {currentStock.change > 0 ? '+' : ''}{currentStock.change.toFixed(2)}%
                             </div>
                        </div>
                    </div>

                    {chartLoading ? (
                        <div className="h-40 flex items-center justify-center">
                            <Loader2 className="animate-spin text-moncchichi-accent" size={32} />
                        </div>
                    ) : chartData.length > 0 ? (
                        <div className="relative h-40 w-full overflow-hidden">
                            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                                <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </div>
                    ) : (
                         <div className="h-40 flex flex-col items-center justify-center text-moncchichi-textSec text-xs gap-2 border-2 border-dashed border-moncchichi-border/50 rounded-lg">
                             <Info size={24} />
                             <span>Chart data unavailable.</span>
                             {marketStatus !== 'LIVE' && <span className="text-moncchichi-error">Market Offline.</span>}
                         </div>
                    )}
                 </div>

                 {assetProfile && assetProfile.longBusinessSummary && (
                     <div className="p-4 bg-moncchichi-surface border border-moncchichi-border rounded-xl">
                         <h3 className="text-xs font-bold text-moncchichi-textSec uppercase mb-2">Company Profile</h3>
                         <p className="text-xs text-moncchichi-text leading-relaxed line-clamp-4">
                             {assetProfile.longBusinessSummary}
                         </p>
                     </div>
                 )}

                 <div className="p-4 bg-moncchichi-surfaceAlt/20 rounded-xl border border-moncchichi-border text-xs text-moncchichi-textSec leading-relaxed">
                     <strong>Goblin Tip:</strong> Real prices, fake money. If the line goes down, just turn the Orb upside down!
                 </div>
            </div>
        );
    };

    const renderTownCrier = () => {
        const hasKeys = keyService.hasKey('FINNHUB');
        if (!hasKeys) {
            return (
                <div className="p-8 text-center flex flex-col items-center justify-center h-full">
                    <div className="bg-moncchichi-error/10 p-4 rounded-full mb-4">
                        <Newspaper size={48} className="text-moncchichi-error" />
                    </div>
                    <h3 className="text-lg font-bold text-moncchichi-text mb-2">News Grid Offline</h3>
                    <p className="text-sm text-moncchichi-textSec mb-6 max-w-xs">
                        The runners cannot retrieve the latest scrolls without a Finnhub API Key.
                    </p>
                    <div className="text-[10px] text-moncchichi-textSec opacity-70">
                        Visit Titan's Vault to configure access.
                    </div>
                </div>
            );
        }

        return <WatchlistNewsPanel className="h-full" />;
    };

    const renderArena = () => (
        <div className="space-y-6 animate-in fade-in">
            {renderStatusBanner()}
            
            {/* Portfolio Summary */}
            <div className="bg-gradient-to-r from-yellow-900/20 to-moncchichi-surface p-4 rounded-xl border border-yellow-700/30 relative">
                <div className="text-xs text-yellow-500 font-bold uppercase mb-1">War Chest (Cash)</div>
                <div className="text-2xl font-black text-moncchichi-text flex items-center gap-2">
                    <Coins className="text-yellow-500" />
                    {portfolio?.cash.toFixed(2)} Gold
                </div>
                <button 
                    onClick={handleResetAccount}
                    className="absolute top-4 right-4 text-moncchichi-textSec hover:text-moncchichi-error p-1"
                    title="Reset Account"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Trade Form */}
            <div className="bg-moncchichi-surface border border-moncchichi-border p-4 rounded-xl space-y-4">
                <h3 className="text-xs font-bold text-moncchichi-textSec uppercase tracking-wider">Execute Order</h3>
                
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] text-moncchichi-textSec mb-1 block">Ticker</label>
                        <select 
                            value={selectedSymbol} 
                            onChange={(e) => setSelectedSymbol(e.target.value)}
                            className="w-full bg-moncchichi-bg border border-moncchichi-border rounded-lg p-2 text-sm text-white focus:outline-none focus:border-moncchichi-accent"
                        >
                            {watchlist.map(s => <option key={s.symbol} value={s.symbol}>{s.symbol} ({s.price > 0 ? '$' + s.price.toFixed(2) : 'N/A'})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] text-moncchichi-textSec mb-1 block">Action</label>
                        <div className="flex bg-moncchichi-bg rounded-lg border border-moncchichi-border p-0.5">
                            <button 
                                onClick={() => setTradeAction('BUY')} 
                                className={`flex-1 text-xs font-bold py-1.5 rounded ${tradeAction === 'BUY' ? 'bg-moncchichi-success text-white' : 'text-moncchichi-textSec'}`}
                            >
                                BUY
                            </button>
                            <button 
                                onClick={() => setTradeAction('SELL')} 
                                className={`flex-1 text-xs font-bold py-1.5 rounded ${tradeAction === 'SELL' ? 'bg-moncchichi-error text-white' : 'text-moncchichi-textSec'}`}
                            >
                                SELL
                            </button>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="text-[10px] text-moncchichi-textSec mb-1 block">Quantity</label>
                    <input 
                        type="number" 
                        min="1"
                        value={tradeQty} 
                        onChange={e => setTradeQty(parseInt(e.target.value) || 1)}
                        className="w-full bg-moncchichi-bg border border-moncchichi-border rounded-lg p-2 text-sm text-white focus:outline-none focus:border-moncchichi-accent"
                    />
                </div>

                <div>
                     <label className="text-[10px] text-moncchichi-textSec mb-1 block">Journal Note (Why?)</label>
                     <input 
                        type="text" 
                        value={tradeNote} 
                        onChange={e => setTradeNote(e.target.value)}
                        placeholder="e.g. I think electric wagons are the future"
                        className="w-full bg-moncchichi-bg border border-moncchichi-border rounded-lg p-2 text-xs text-white focus:outline-none focus:border-moncchichi-accent"
                     />
                </div>

                <button 
                    onClick={handleTrade}
                    disabled={marketStatus !== 'LIVE'}
                    className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 ${
                        marketStatus !== 'LIVE' 
                        ? 'bg-moncchichi-surfaceAlt text-moncchichi-textSec opacity-50 cursor-not-allowed' 
                        : (tradeAction === 'BUY' ? 'bg-moncchichi-success text-white shadow-moncchichi-success/20' : 'bg-moncchichi-error text-white shadow-moncchichi-error/20')
                    }`}
                >
                    {marketStatus === 'LIVE' ? `${tradeAction} ${tradeQty} ${selectedSymbol}` : "Market Unavailable"}
                </button>
            </div>

            {/* Holdings */}
            <div>
                <h3 className="text-xs font-bold text-moncchichi-textSec uppercase tracking-wider mb-2">Inventory</h3>
                {portfolio && Object.keys(portfolio.holdings).length > 0 ? (
                    <div className="space-y-2">
                        {Object.entries(portfolio.holdings).map(([sym, rawData]) => {
                            const data = rawData as { qty: number, avgPrice: number };
                            const currentPrice = watchlist.find(s => s.symbol === sym)?.price || 0;
                            const profit = (currentPrice - data.avgPrice) * data.qty;
                            
                            return (
                                <div key={sym} className="bg-moncchichi-surface border border-moncchichi-border p-3 rounded-xl flex justify-between items-center">
                                    <div>
                                        <div className="font-bold text-sm text-white">{sym}</div>
                                        <div className="text-[10px] text-moncchichi-textSec">{data.qty} shares @ ${data.avgPrice.toFixed(2)}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-white">${(currentPrice * data.qty).toFixed(2)}</div>
                                        <div className={`text-[10px] font-bold ${profit >= 0 ? 'text-moncchichi-success' : 'text-moncchichi-error'}`}>
                                            {profit >= 0 ? '+' : ''}{profit.toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-6 text-moncchichi-textSec opacity-50 text-xs flex flex-col items-center gap-2">
                        <PieChart size={24} />
                        <span>Your bags are empty.</span>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-moncchichi-bg">
            {/* Header */}
            <div className="px-4 py-3 border-b border-moncchichi-border bg-moncchichi-surface flex items-center gap-3 sticky top-0 z-20 shadow-sm">
                <button onClick={onBack} className="p-2 -ml-2 text-moncchichi-textSec hover:text-moncchichi-text rounded-full hover:bg-moncchichi-surfaceAlt transition-colors">
                    {ICONS.Back}
                </button>
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-moncchichi-text tracking-tight flex items-center gap-2">
                        {ICONS.Brokerage} Goblin Brokerage
                    </h2>
                </div>
                <button 
                    onClick={() => {
                        brokerageService.refreshMarketData();
                        soundService.playClick();
                    }} 
                    className="p-2 text-moncchichi-textSec hover:text-moncchichi-text"
                >
                    <RefreshCw size={18} className={marketStatus === 'LOADING' ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Tab Nav */}
            <div className="px-4 py-2 border-b border-moncchichi-border bg-moncchichi-bg/50 backdrop-blur-sm sticky top-[57px] z-10">
                <div className="flex p-1 bg-moncchichi-surfaceAlt rounded-lg overflow-x-auto no-scrollbar">
                    {[
                        { id: 'TOWN_CRIER', label: 'News', icon: <MessageSquare size={14} /> },
                        { id: 'WAR_TABLE', label: 'Watchlist', icon: <Scroll size={14} /> },
                        { id: 'SCRYING_ORB', label: 'Charts', icon: <Search size={14} /> },
                        { id: 'ARENA', label: 'Paper', icon: <Swords size={14} /> },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as Tab)}
                            className={`flex-1 min-w-[80px] py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === tab.id ? 'bg-moncchichi-text text-moncchichi-bg shadow-sm' : 'text-moncchichi-textSec hover:text-moncchichi-text'}`}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-40">
                {activeTab === 'WAR_TABLE' && renderWarTable()}
                {activeTab === 'SCRYING_ORB' && renderScryingOrb()}
                {activeTab === 'TOWN_CRIER' && renderTownCrier()}
                {activeTab === 'ARENA' && renderArena()}
            </div>

            {/* Advisor Chat Overlay (Bottom) */}
            <div className="border-t border-moncchichi-border bg-moncchichi-surface p-4 pb-safe">
                {advisorResponse && (
                    <div className="mb-4 p-3 bg-moncchichi-surfaceAlt/80 border border-moncchichi-accent/30 rounded-xl text-xs text-moncchichi-text leading-relaxed whitespace-pre-wrap animate-in slide-in-from-bottom-2">
                        <strong className="text-moncchichi-accent block mb-1">Trade Prince Gallywix says:</strong>
                        {advisorResponse}
                    </div>
                )}
                
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        placeholder="Ask the Trade Prince (e.g. What is a stock?)"
                        className="flex-1 bg-moncchichi-bg border border-moncchichi-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-moncchichi-accent"
                        onKeyDown={e => e.key === 'Enter' && handleAskAdvisor()}
                    />
                    <button 
                        onClick={handleAskAdvisor}
                        disabled={isAdvising || !chatInput.trim()}
                        className="bg-moncchichi-accent text-moncchichi-bg p-3 rounded-xl shadow-lg active:scale-95 disabled:opacity-50 transition-all"
                    >
                        {isAdvising ? <RefreshCw className="animate-spin" size={20} /> : <Send size={20} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GoblinBrokerage;
