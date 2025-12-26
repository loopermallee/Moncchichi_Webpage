import { NewsItem } from '../types/financeNews';
import { keyService } from './keyService';
import { mockService } from './mockService';

class FinnhubNewsService {
    public async getNewsForWatchlist(symbols: string[]): Promise<NewsItem[]> {
        if (!symbols || symbols.length === 0) return [];

        const apiKey = keyService.get('FINNHUB');
        if (!apiKey) {
            mockService.emitLog('NEWS', 'WARN', 'Missing FINNHUB API key. Returning empty news list.');
            return [];
        }

        // Placeholder: integrate real fetch when API is available.
        return symbols.map((symbol, idx) => ({
            id: `${symbol}-${idx}`,
            title: `${symbol} update unavailable`,
            url: 'https://finnhub.io/',
            source: 'Finnhub',
            publishedAt: Date.now(),
            tickers: [symbol],
            summary: 'News data not available in this environment.',
        }));
    }

    public async analyzeNews(item: NewsItem): Promise<NewsItem> {
        // Placeholder analysis simply echoes the item.
        return {
            ...item,
            aiSummary: item.aiSummary || 'Analysis unavailable.',
        };
    }
}

export const finnhubNewsService = new FinnhubNewsService();
