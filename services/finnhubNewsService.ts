
import { NewsItem, FinnhubNewsItem, NewsCacheEntry } from '../types/financeNews';
import { keyService } from './keyService';
import { mockService } from './mockService';
import { aiService } from './aiService';

const PROXY_URL = 'https://corsproxy.io/?';
const BASE_URL = 'https://finnhub.io/api/v1';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 Minutes

class FinnhubNewsService {
    // In-memory cache to reduce IDB reads
    private memoryCache: Map<string, NewsCacheEntry> = new Map();

    /**
     * Wrapper for Fetch with Retry logic and Logging
     */
    private async fetchJsonWithRetry(url: string, retries = 2, delay = 1000): Promise<any> {
        const apiKey = keyService.get('FINNHUB');
        if (!apiKey) throw new Error("Missing Finnhub API Key");

        // Append token if not present
        const separator = url.includes('?') ? '&' : '?';
        const authUrl = `${url}${separator}token=${apiKey}`;
        const targetUrl = `${PROXY_URL}${encodeURIComponent(authUrl)}`;

        for (let i = 0; i <= retries; i++) {
            try {
                const response = await fetch(targetUrl);
                
                if (response.status === 429) {
                    mockService.emitLog('NEWS_SVC', 'WARN', `Rate limited. Retrying in ${delay}ms...`);
                    await new Promise(r => setTimeout(r, delay * (i + 1))); // Exponential backoff
                    continue;
                }
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return await response.json();
            } catch (e: any) {
                if (i === retries) throw e;
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    /**
     * Fetch news for a single ticker with caching
     */
    private async fetchTickerNews(symbol: string): Promise<NewsItem[]> {
        const cacheKey = `news_${symbol}`;
        const now = Date.now();

        // 1. Check Cache
        if (this.memoryCache.has(cacheKey)) {
            const entry = this.memoryCache.get(cacheKey)!;
            if (now - entry.timestamp < CACHE_TTL_MS) {
                return entry.data;
            }
        }

        // 2. Fetch Fresh
        try {
            // Get last 3 days of news
            const toDate = new Date().toISOString().split('T')[0];
            const fromDate = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            
            const url = `${BASE_URL}/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}`;
            const data: FinnhubNewsItem[] = await this.fetchJsonWithRetry(url);

            const mapped: NewsItem[] = data.map(item => ({
                id: item.url, // URL is the best dedupe key
                title: item.headline,
                summary: item.summary,
                url: item.url,
                imageUrl: item.image,
                source: item.source,
                publishedAt: item.datetime * 1000,
                tickers: [symbol] // Tag with the requested symbol
            }));

            // 3. Update Cache
            this.memoryCache.set(cacheKey, { timestamp: now, data: mapped });
            return mapped;

        } catch (e: any) {
            mockService.emitLog('NEWS_SVC', 'ERROR', `Failed to fetch ${symbol}: ${e.message}`);
            return [];
        }
    }

    /**
     * Main Entry Point: Get merged news for a list of tickers
     * Concurrency Limit: 3
     */
    public async getNewsForWatchlist(tickers: string[]): Promise<NewsItem[]> {
        if (!keyService.get('FINNHUB')) {
            mockService.emitLog('NEWS_SVC', 'WARN', 'No API Key. Returning empty.');
            return [];
        }

        const uniqueTickers = Array.from(new Set(tickers));
        mockService.emitLog('NEWS_SVC', 'INFO', `Fetching news for ${uniqueTickers.length} tickers...`);

        const results: NewsItem[] = [];
        const concurrencyLimit = 3;

        // Process in chunks
        for (let i = 0; i < uniqueTickers.length; i += concurrencyLimit) {
            const chunk = uniqueTickers.slice(i, i + concurrencyLimit);
            const promises = chunk.map(sym => this.fetchTickerNews(sym));
            
            const chunkResults = await Promise.all(promises);
            chunkResults.forEach(r => results.push(...r));
        }

        // Deduplicate and Merge Tickers
        const dedupedMap = new Map<string, NewsItem>();
        
        results.forEach(item => {
            if (dedupedMap.has(item.id)) {
                // Merge tickers if same article found for multiple symbols
                const existing = dedupedMap.get(item.id)!;
                const mergedTickers = Array.from(new Set([...(existing.tickers || []), ...(item.tickers || [])]));
                dedupedMap.set(item.id, { ...existing, tickers: mergedTickers });
            } else {
                dedupedMap.set(item.id, item);
            }
        });

        // Sort by Time (Newest First)
        return Array.from(dedupedMap.values()).sort((a, b) => b.publishedAt - a.publishedAt);
    }

    /**
     * AI Analysis for a specific news item
     */
    public async analyzeNews(item: NewsItem): Promise<NewsItem> {
        mockService.emitLog('NEWS_AI', 'INFO', `Analyzing: ${item.title.substring(0, 20)}...`);

        const prompt = `
        Analyze this financial news article:
        Title: "${item.title}"
        Summary: "${item.summary || ''}"
        Related Tickers: ${item.tickers?.join(', ') || 'General Market'}

        Output a JSON object with exactly two fields:
        1. "plainSummary": A 1-sentence plain English explanation of what happened, removing jargon.
        2. "watchNext": A short suggestion on what specific metric or event to watch next (e.g., "Watch if stock breaks $150").
        `;

        try {
            const res = await aiService.generateText({
                userPrompt: prompt,
                temperature: 0.3,
                systemInstruction: "You are a senior financial analyst for retail investors."
            });

            // Parse response (remove markdown code blocks if any)
            const jsonStr = res.text.replace(/```json/g, '').replace(/```/g, '').trim();
            const analysis = JSON.parse(jsonStr);

            return {
                ...item,
                aiSummary: analysis.plainSummary,
                aiWatchNext: analysis.watchNext,
                isAnalyzing: false
            };
        } catch (e: any) {
            mockService.emitLog('NEWS_AI', 'ERROR', `Analysis failed: ${e.message}`);
            return { ...item, isAnalyzing: false };
        }
    }
}

export const finnhubNewsService = new FinnhubNewsService();
