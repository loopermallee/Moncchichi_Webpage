export interface NewsItem {
    id: string;
    title: string;
    summary?: string;
    url: string;
    source?: string;
    publishedAt: number;
    imageUrl?: string;
    tickers?: string[];
    aiSummary?: string;
    aiWatchNext?: string;
}

export type FinanceNewsItem = NewsItem;
