
import { NewsItem } from '../types/financeNews';
import { keyService } from './keyService';
import { storageService } from './storageService';
import { mockService } from './mockService';
import { yahooFinanceService } from './yahooFinanceService';

const CACHE_KEY = 'finance_news_cache';
const CACHE_TTL_MINUTES = 3;

class FinanceNewsService {
    
    private async fetchFinnhub(limit: number): Promise<NewsItem[]> {
        const apiKey = keyService.get('FINNHUB');
        if (!apiKey) {
            // Finnhub key missing - Silent log to avoid spam
            return [];
        }

        try {
            const url = `https://finnhub.io/api/v1/news?category=general&token=${apiKey}`;
            const res = await fetch(url);
            
            if (res.status === 429) {
                mockService.emitLog('NEWS', 'WARN', 'Finnhub rate limited');
                return [];
            }
            if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
            
            const data = await res.json();
            if (!Array.isArray(data)) return [];

            return data.slice(0, limit).map((item: any) => ({
                id: item.url,
                title: item.headline,
                summary: item.summary,
                url: item.url,
                imageUrl: item.image,
                source: item.source || 'Finnhub',
                publishedAt: item.datetime * 1000,
                tickers: item.related ? item.related.split(',').map((s: string) => s.trim()) : []
            }));
        } catch (e: any) {
            mockService.emitLog('NEWS', 'ERROR', `Finnhub failed: ${e.message}`);
            return [];
        }
    }

    private async fetchAlphaVantage(tickers: string[], limit: number): Promise<NewsItem[]> {
        const apiKey = keyService.get('ALPHAVANTAGE');
        if (!apiKey) {
             // AlphaVantage key missing
            return [];
        }

        try {
            const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=finance&limit=${limit}&apikey=${apiKey}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data['Note'] || data['Information']) {
                 mockService.emitLog('NEWS', 'WARN', 'AlphaVantage limit reached');
                 return [];
            }

            if (!data.feed) return [];

            return data.feed.map((item: any) => {
                // Parse "20230402T143500" format
                const tStr = item.time_published;
                const year = parseInt(tStr.substring(0, 4));
                const month = parseInt(tStr.substring(4, 6)) - 1;
                const day = parseInt(tStr.substring(6, 8));
                const hour = parseInt(tStr.substring(9, 11));
                const min = parseInt(tStr.substring(11, 13));
                const date = new Date(year, month, day, hour, min);

                return {
                    id: item.url,
                    title: item.title,
                    summary: item.summary,
                    url: item.url,
                    imageUrl: item.banner_image,
                    source: item.source || 'Alpha Vantage',
                    publishedAt: date.getTime(),
                    tickers: item.ticker_sentiment?.map((t: any) => t.ticker) || []
                };
            });
        } catch (e: any) {
            mockService.emitLog('NEWS', 'ERROR', `AlphaVantage failed: ${e.message}`);
            return [];
        }
    }
    
    private async fetchYahooNews(tickers: string[]): Promise<NewsItem[]> {
        try {
            return await yahooFinanceService.getNews(tickers);
        } catch (e: any) {
            mockService.emitLog('NEWS', 'ERROR', `Yahoo News failed: ${e.message}`);
            return [];
        }
    }

    public async getNews(
        options: { tickers?: string[], limit?: number, forceRefresh?: boolean } = {}
    ): Promise<NewsItem[]> {
        const { tickers = [], limit = 20, forceRefresh = false } = options;
        
        // 1. Check Cache
        if (!forceRefresh) {
            const cached = await storageService.getCache<NewsItem[]>(CACHE_KEY);
            if (cached && cached.length > 0) {
                mockService.emitLog('NEWS', 'INFO', `Served ${cached.length} items from cache`);
                return cached;
            }
        }

        mockService.emitLog('NEWS', 'INFO', 'Fetching fresh news...');

        // 2. Fetch Parallel (Yahoo + Finnhub + AV)
        const [yahoo, finnhub, av] = await Promise.all([
            this.fetchYahooNews(tickers),
            this.fetchFinnhub(limit),
            // Only fetch AV if explicit key provided to save limited quota
            keyService.get('ALPHAVANTAGE') ? this.fetchAlphaVantage(tickers, 5) : Promise.resolve([])
        ]);

        // 3. Merge & Dedupe
        // Prioritize Yahoo as it often has better images/summaries
        const combined = [...yahoo, ...finnhub, ...av];
        const unique = new Map<string, NewsItem>();
        
        combined.forEach(item => {
            if (!unique.has(item.url)) {
                unique.set(item.url, item);
            }
        });

        const sorted = Array.from(unique.values()).sort((a, b) => b.publishedAt - a.publishedAt);
        
        // 4. Cache
        if (sorted.length > 0) {
            await storageService.setCache(CACHE_KEY, sorted, CACHE_TTL_MINUTES);
            mockService.emitLog('NEWS', 'INFO', `Cached ${sorted.length} unique news items`);
        } else {
             mockService.emitLog('NEWS', 'WARN', 'No news found from any provider');
        }

        return sorted;
    }
}

export const financeNewsService = new FinanceNewsService();
