
import { storageService } from './storageService';
import { mockService } from './mockService';

const WATCHLIST_KEY = 'user_watchlist_symbols';

class WatchlistService {
    private listeners: (() => void)[] = [];
    private symbols: Set<string> = new Set(['AAPL', 'TSLA', 'NVDA', 'BTC-USD']); // Default seed

    constructor() {
        this.load();
    }

    private async load() {
        try {
            const stored = await storageService.getCache<string[]>(WATCHLIST_KEY);
            if (stored && Array.isArray(stored)) {
                this.symbols = new Set(stored);
            }
            this.notifyListeners();
        } catch (e) {
            console.warn("Failed to load watchlist");
        }
    }

    private async save() {
        const arr = Array.from(this.symbols);
        // Save with long TTL (virtually permanent)
        await storageService.setCache(WATCHLIST_KEY, arr, 525600); 
        this.notifyListeners();
    }

    public subscribe(cb: () => void) {
        this.listeners.push(cb);
        // Fire immediately with current state
        cb();
        return () => {
            this.listeners = this.listeners.filter(l => l !== cb);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(l => l());
    }

    public getSymbols(): string[] {
        return Array.from(this.symbols);
    }

    public addSymbol(symbol: string) {
        const clean = symbol.toUpperCase().trim();
        if (!this.symbols.has(clean)) {
            this.symbols.add(clean);
            this.save();
            mockService.emitLog('WATCHLIST', 'INFO', `Added ${clean}`);
        }
    }

    public removeSymbol(symbol: string) {
        if (this.symbols.has(symbol)) {
            this.symbols.delete(symbol);
            this.save();
            mockService.emitLog('WATCHLIST', 'INFO', `Removed ${symbol}`);
        }
    }

    public hasSymbol(symbol: string): boolean {
        return this.symbols.has(symbol.toUpperCase());
    }
}

export const watchlistService = new WatchlistService();
