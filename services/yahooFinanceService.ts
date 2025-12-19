
import { mockService } from "./mockService";
import { NewsItem } from "../types/financeNews";

const PROXY_URL = 'https://corsproxy.io/?';
const YAHOO_BASE = 'https://query1.finance.yahoo.com';

export interface YahooQuote {
    symbol: string;
    shortName: string;
    regularMarketPrice: number;
    regularMarketChangePercent: number;
    regularMarketChange: number;
    marketState: string;
    currency: string;
    longName?: string;
    sector?: string;
    industry?: string;
}

export interface YahooSearchResult {
    symbol: string;
    shortname: string;
    longname: string;
    typeDisp: string;
    exchange: string;
}

export interface YahooChartPoint {
    timestamp: number;
    close: number;
}

class YahooFinanceService {
    
    private async fetch(endpoint: string, params: Record<string, string> = {}) {
        const url = new URL(`${YAHOO_BASE}${endpoint}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        
        const targetUrl = `${PROXY_URL}${encodeURIComponent(url.toString())}`;
        
        try {
            const res = await fetch(targetUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e: any) {
            mockService.emitLog('YAHOO', 'WARN', `Fetch failed: ${endpoint} - ${e.message}`);
            return null;
        }
    }

    /**
     * Search for tickers (Equities, Indices, ETFs)
     */
    public async search(query: string): Promise<YahooSearchResult[]> {
        const data = await this.fetch('/v1/finance/search', {
            q: query,
            quotesCount: '6',
            newsCount: '0'
        });

        if (data && data.quotes) {
            return data.quotes
                .filter((q: any) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF' || q.quoteType === 'INDEX')
                .map((q: any) => ({
                    symbol: q.symbol,
                    shortname: q.shortname,
                    longname: q.longname,
                    typeDisp: q.quoteType,
                    exchange: q.exchange
                }));
        }
        return [];
    }

    /**
     * Get News for Tickers or General
     */
    public async getNews(symbols: string[]): Promise<NewsItem[]> {
        // We use v2/finance/news if symbols provided, otherwise general search
        const endpoint = '/v2/finance/news'; // Often better structured than search news
        const params: Record<string, string> = {};
        
        if (symbols && symbols.length > 0) {
            params.symbols = symbols.join(',');
        } else {
            params.count = '20';
        }

        const data = await this.fetch(endpoint, params);
        
        if (data && data.news) {
             return data.news.map((n: any) => ({
                 id: n.uuid,
                 title: n.title,
                 summary: n.summary || n.type || '',
                 url: n.link,
                 source: n.publisher || 'Yahoo Finance',
                 publishedAt: n.providerPublishTime * 1000,
                 imageUrl: n.thumbnail?.resolutions?.[0]?.url,
                 tickers: n.relatedTickers || []
             }));
        }
        return [];
    }

    /**
     * Get live quotes for multiple symbols
     */
    public async getQuotes(symbols: string[]): Promise<YahooQuote[]> {
        if (symbols.length === 0) return [];
        
        const data = await this.fetch('/v7/finance/quote', {
            symbols: symbols.join(',')
        });

        if (data && data.quoteResponse && data.quoteResponse.result) {
            return data.quoteResponse.result.map((q: any) => ({
                symbol: q.symbol,
                shortName: q.shortName || q.longName || q.symbol,
                longName: q.longName,
                regularMarketPrice: q.regularMarketPrice,
                regularMarketChangePercent: q.regularMarketChangePercent,
                regularMarketChange: q.regularMarketChange,
                marketState: q.marketState,
                currency: q.currency,
                sector: q.sector, // Add sector mapping if available in quote response
                industry: q.industry
            }));
        }
        return [];
    }

    /**
     * Get chart data (1 day, 5m interval)
     */
    public async getChart(symbol: string, range: string = '1d', interval: string = '5m'): Promise<YahooChartPoint[]> {
        const data = await this.fetch(`/v8/finance/chart/${symbol}`, {
            range,
            interval,
            includePrePost: 'false'
        });

        if (data && data.chart && data.chart.result) {
            const res = data.chart.result[0];
            const timestamps = res.timestamp || [];
            const quotes = res.indicators.quote[0];
            
            const points: YahooChartPoint[] = [];
            
            timestamps.forEach((ts: number, i: number) => {
                // Some intervals might have null data
                if (quotes.close[i] !== null && quotes.close[i] !== undefined) {
                    points.push({
                        timestamp: ts * 1000,
                        close: quotes.close[i]
                    });
                }
            });
            return points;
        }
        return [];
    }

    /**
     * Get Asset Profile (Sector/Industry) - Note: Often blocked or requires modules
     */
    public async getAssetProfile(symbol: string) {
        try {
            const data = await this.fetch(`/v10/finance/quoteSummary/${symbol}`, {
                modules: 'assetProfile'
            });
            
            if (data && data.quoteSummary && data.quoteSummary.result && data.quoteSummary.result.length > 0) {
                return data.quoteSummary.result[0].assetProfile;
            }
        } catch(e) {
            console.warn("Profile fetch failed");
        }
        return null;
    }
}

export const yahooFinanceService = new YahooFinanceService();
