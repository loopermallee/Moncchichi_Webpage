
import { storageService } from './storageService';
import { yahooFinanceService } from './yahooFinanceService';
import { mockService } from './mockService';

export interface StockTicker {
    symbol: string;
    name: string;
    price: number;
    change: number; // Percent change
    sector?: string;
    desc?: string;
    currency?: string;
}

export interface NewsHeadline {
    id: string;
    symbol: string;
    headline: string;
    goblinTake: string; 
    timestamp: number;
}

export interface PaperTrade {
    id: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    qty: number;
    price: number;
    timestamp: number;
    note?: string;
}

export interface PortfolioSummary {
    cash: number;
    holdings: Record<string, { qty: number; avgPrice: number }>;
}

export type MarketStatus = 'LIVE' | 'CLOSED' | 'UNAVAILABLE' | 'ERROR' | 'LOADING';

// Default Real Data for new users (No more fake goblins)
const DEFAULT_WATCHLIST = ["SPY", "QQQ", "AAPL", "NVDA", "TSLA", "GME", "BTC-USD"];

class BrokerageService {
    private listeners: (() => void)[] = [];
    private currentMarketData: Map<string, StockTicker> = new Map();
    private updateInterval: any = null;
    private marketStatus: MarketStatus = 'LOADING';

    constructor() {
        this.initialize();
        this.startLiveUpdates();
    }

    private async initialize() {
        // Ensure we have at least the default watchlist in DB if empty
        const stored = await storageService.getAllItems<StockTicker>('watchlist');
        if (stored.length === 0) {
            for (const sym of DEFAULT_WATCHLIST) {
                // Temporary placeholder until first fetch
                await storageService.saveItem('watchlist', { 
                    symbol: sym, name: sym, price: 0, change: 0, sector: 'Pending' 
                });
            }
        }
        this.refreshMarketData();
    }

    private startLiveUpdates() {
        // Update every 15 seconds
        this.updateInterval = setInterval(() => this.refreshMarketData(), 15000);
    }

    public subscribe(cb: () => void) {
        this.listeners.push(cb);
        return () => {
            this.listeners = this.listeners.filter(l => l !== cb);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(l => l());
    }

    // --- Market Data ---

    public getMarketStatus(): MarketStatus {
        return this.marketStatus;
    }

    public async refreshMarketData() {
        // 1. Get Symbols to Fetch
        const watchlist = await this.getWatchlist();
        const symbols = watchlist.map(s => s.symbol);

        if (symbols.length === 0) {
            this.marketStatus = 'LIVE'; // Nothing to fetch, but system is okay
            return;
        }

        try {
            mockService.emitLog('BROKER', 'INFO', `Fetching Yahoo quotes for ${symbols.length} tickers...`);
            const quotes = await yahooFinanceService.getQuotes(symbols);
            
            if (!quotes || quotes.length === 0) {
                // If we requested symbols but got nothing, API might be down or blocked
                this.marketStatus = 'UNAVAILABLE';
                mockService.emitLog('BROKER', 'WARN', 'Market data unavailable (Network/API).');
            } else {
                this.marketStatus = 'LIVE';
                
                // Update In-Memory Map
                quotes.forEach(q => {
                    const ticker: StockTicker = {
                        symbol: q.symbol,
                        name: q.shortName || q.longName || q.symbol,
                        price: q.regularMarketPrice,
                        change: q.regularMarketChangePercent,
                        sector: q.sector,
                        desc: q.longName,
                        currency: q.currency
                    };
                    this.currentMarketData.set(q.symbol, ticker);
                    
                    // Update persistence lazily (to keep offline cache fresh)
                    storageService.saveItem('watchlist', ticker);
                });
            }
        } catch (e) {
            this.marketStatus = 'ERROR';
            mockService.emitLog('BROKER', 'ERROR', 'Failed to fetch Yahoo data');
        }

        this.notifyListeners();
    }

    public getStockData(symbol: string): StockTicker | undefined {
        return this.currentMarketData.get(symbol);
    }

    // --- Watchlist ---

    public async addToWatchlist(symbol: string) {
        // Validation: Must exist in Yahoo
        const quotes = await yahooFinanceService.getQuotes([symbol]);
        
        if (quotes.length > 0) {
            const q = quotes[0];
            const stock: StockTicker = {
                symbol: q.symbol,
                name: q.shortName || q.symbol,
                price: q.regularMarketPrice,
                change: q.regularMarketChangePercent,
                sector: q.sector,
                desc: q.longName,
                currency: q.currency
            };
            this.currentMarketData.set(symbol, stock);
            await storageService.saveItem('watchlist', stock);
            this.notifyListeners();
            return stock;
        } else {
            throw new Error(`Ticker '${symbol}' not found on the exchange.`);
        }
    }

    public async removeFromWatchlist(symbol: string) {
        await storageService.deleteItem('watchlist', symbol);
        this.currentMarketData.delete(symbol);
        this.notifyListeners();
    }

    public async getWatchlist(): Promise<StockTicker[]> {
        const stored = await storageService.getAllItems<StockTicker>('watchlist');
        // Return latest in-memory data for stored symbols if available, else stored cache
        return stored.map(s => this.currentMarketData.get(s.symbol) || s);
    }

    // --- News ---

    public getMockNews(): NewsHeadline[] {
        // Keep flavor text, but we also rely on financeNewsService in the UI
        const headlines = [
            "Goblin Engineers report 'record profits', ignore explosions.",
            "Trade Prince Gallywix demands more gold.",
            "Short sellers retreating to the Undercity.",
            "Bulls running rampant in Mulgore.",
        ];
        
        return headlines.map((h, i) => ({
            id: `news-${Date.now()}-${i}`,
            symbol: "GEN",
            headline: h,
            goblinTake: "Time is money, friend!",
            timestamp: Date.now() - (i * 3600000)
        }));
    }

    // --- Paper Trading ---

    public async getPortfolio(): Promise<PortfolioSummary> {
        const trades = await storageService.getAllItems<PaperTrade>('paper_trades');
        
        let cash = 10000;
        const holdings: Record<string, { qty: number; avgPrice: number }> = {};

        trades.sort((a, b) => a.timestamp - b.timestamp).forEach(t => {
            const cost = t.qty * t.price;
            if (t.type === 'BUY') {
                cash -= cost;
                if (!holdings[t.symbol]) holdings[t.symbol] = { qty: 0, avgPrice: 0 };
                const oldTotalCost = holdings[t.symbol].qty * holdings[t.symbol].avgPrice;
                const newTotalQty = holdings[t.symbol].qty + t.qty;
                holdings[t.symbol].avgPrice = (oldTotalCost + cost) / newTotalQty;
                holdings[t.symbol].qty = newTotalQty;
            } else {
                cash += cost;
                if (holdings[t.symbol]) {
                    holdings[t.symbol].qty -= t.qty;
                    if (holdings[t.symbol].qty <= 0) delete holdings[t.symbol];
                }
            }
        });

        return { cash, holdings };
    }

    public async executeTrade(symbol: string, type: 'BUY' | 'SELL', qty: number, note?: string): Promise<string> {
        const stock = this.getStockData(symbol);
        
        // STRICT CHECK: Cannot trade if data is missing or price is 0
        if (!stock || !stock.price || stock.price <= 0) {
             throw new Error("Market data unavailable for this ticker. Cannot execute trade.");
        }
        
        const portfolio = await this.getPortfolio();
        const cost = qty * stock.price;

        if (type === 'BUY') {
            if (portfolio.cash < cost) throw new Error("Not enough gold in the chest!");
        } else {
            const holding = portfolio.holdings[symbol];
            if (!holding || holding.qty < qty) throw new Error("You don't own enough of that asset!");
        }

        const trade: PaperTrade = {
            id: `trade-${Date.now()}`,
            symbol,
            type,
            qty,
            price: stock.price,
            timestamp: Date.now(),
            note
        };

        await storageService.saveItem('paper_trades', trade);
        this.notifyListeners();
        return `${type} ${qty} ${symbol} @ $${stock.price.toFixed(2)} completed!`;
    }
    
    public async resetAccount() {
        const trades = await storageService.getAllItems<PaperTrade>('paper_trades');
        for (const t of trades) await storageService.deleteItem('paper_trades', t.id);
        this.notifyListeners();
    }
}

export const brokerageService = new BrokerageService();
