
import React, { useState, useEffect } from 'react';
import { NewsItem } from '../types/financeNews';
import { finnhubNewsService } from '../services/finnhubNewsService';
import { watchlistService } from '../services/watchlistService';
import { Loader2, RefreshCw, Filter, Sparkles, ExternalLink, Clock, Tag } from 'lucide-react';

interface Props {
    className?: string;
}

const WatchlistNewsPanel: React.FC<Props> = ({ className }) => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterTicker, setFilterTicker] = useState<string | null>(null);
    const [only24h, setOnly24h] = useState(false);
    const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());

    const refreshNews = async () => {
        setLoading(true);
        const symbols = watchlistService.getSymbols();
        if (symbols.length === 0) {
            setNews([]);
            setLoading(false);
            return;
        }

        const items = await finnhubNewsService.getNewsForWatchlist(symbols);
        setNews(items);
        setLoading(false);
    };

    // Load on mount and when watchlist changes
    useEffect(() => {
        refreshNews();
        const unsub = watchlistService.subscribe(() => {
            // Optionally auto-refresh when watchlist changes, 
            // but might be aggressive. For now, we rely on manual refresh or initial load.
        });
        return unsub;
    }, []);

    const handleAnalyze = async (item: NewsItem) => {
        if (analyzingIds.has(item.id)) return;

        setAnalyzingIds(prev => new Set(prev).add(item.id));
        const enriched = await finnhubNewsService.analyzeNews(item);
        
        setNews(prev => prev.map(n => n.id === enriched.id ? enriched : n));
        setAnalyzingIds(prev => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
        });
    };

    // Filtering Logic
    const filteredNews = news.filter(item => {
        const matchesTicker = filterTicker ? item.tickers?.includes(filterTicker) : true;
        const matchesTime = only24h ? (Date.now() - item.publishedAt < 24 * 60 * 60 * 1000) : true;
        return matchesTicker && matchesTime;
    });

    const uniqueTickers = Array.from(new Set(news.flatMap(n => n.tickers || []))).sort();

    return (
        <div className={`flex flex-col h-full bg-moncchichi-bg ${className}`}>
            {/* Header / Controls */}
            <div className="p-4 border-b border-moncchichi-border bg-moncchichi-surface/90 backdrop-blur sticky top-0 z-10 space-y-3">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-moncchichi-text uppercase tracking-wider flex items-center gap-2">
                        <Sparkles size={14} className="text-moncchichi-accent" /> Market Intelligence
                    </h3>
                    <button 
                        onClick={refreshNews} 
                        disabled={loading}
                        className="p-1.5 rounded-full bg-moncchichi-surfaceAlt text-moncchichi-textSec hover:text-moncchichi-text transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    <button 
                        onClick={() => setOnly24h(!only24h)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${only24h ? 'bg-moncchichi-accent/10 border-moncchichi-accent text-moncchichi-accent' : 'bg-moncchichi-surfaceAlt border-transparent text-moncchichi-textSec'}`}
                    >
                        <Clock size={12} /> Last 24h
                    </button>
                    
                    {uniqueTickers.map((t: string) => (
                        <button
                            key={t}
                            onClick={() => setFilterTicker(filterTicker === t ? null : t)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${filterTicker === t ? 'bg-moncchichi-text text-moncchichi-bg border-moncchichi-text' : 'bg-moncchichi-surfaceAlt border-transparent text-moncchichi-textSec'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* News List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading && news.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 opacity-50">
                        <Loader2 size={32} className="animate-spin text-moncchichi-accent" />
                        <span className="text-xs mt-2">Gathering intel...</span>
                    </div>
                )}

                {!loading && filteredNews.length === 0 && (
                    <div className="text-center py-12 text-moncchichi-textSec opacity-50 text-xs">
                        No news found for current filters.
                    </div>
                )}

                {filteredNews.map(item => (
                    <div key={item.id} className="bg-moncchichi-surface border border-moncchichi-border rounded-xl overflow-hidden hover:border-moncchichi-accent/30 transition-colors group">
                        <div className="p-3">
                            <div className="flex justify-between items-start gap-3 mb-2">
                                <div className="flex gap-2 flex-wrap">
                                    {item.tickers?.map(t => (
                                        <span key={t} className="text-[9px] font-bold bg-moncchichi-surfaceAlt px-1.5 py-0.5 rounded border border-moncchichi-border text-moncchichi-textSec">
                                            {t}
                                        </span>
                                    ))}
                                    <span className="text-[9px] text-moncchichi-textSec/70 flex items-center">
                                        {new Date(item.publishedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {item.source}
                                    </span>
                                </div>
                                <a 
                                    href={item.url} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-moncchichi-textSec hover:text-moncchichi-text"
                                >
                                    <ExternalLink size={14} />
                                </a>
                            </div>

                            <div className="flex gap-3">
                                {item.imageUrl && (
                                    <div className="w-20 h-20 shrink-0 bg-moncchichi-surfaceAlt rounded-lg overflow-hidden">
                                        <img src={item.imageUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" loading="lazy" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-bold text-moncchichi-text leading-tight mb-1 line-clamp-2">
                                        {item.title}
                                    </h4>
                                    <p className="text-xs text-moncchichi-textSec line-clamp-2 mb-2">
                                        {item.summary}
                                    </p>
                                </div>
                            </div>
                            
                            {/* AI Analysis Section */}
                            {(item.aiSummary || analyzingIds.has(item.id)) && (
                                <div className="mt-3 pt-3 border-t border-moncchichi-border/50 animate-in fade-in slide-in-from-top-1">
                                    {analyzingIds.has(item.id) ? (
                                        <div className="flex items-center gap-2 text-xs text-moncchichi-accent">
                                            <Loader2 size={12} className="animate-spin" />
                                            <span>Analyzing market impact...</span>
                                        </div>
                                    ) : (
                                        <div className="bg-moncchichi-surfaceAlt/30 p-2 rounded-lg border border-moncchichi-accent/20">
                                            <div className="flex items-start gap-2 mb-1">
                                                <Sparkles size={12} className="text-moncchichi-accent shrink-0 mt-0.5" />
                                                <p className="text-xs text-moncchichi-text font-medium leading-relaxed">
                                                    {item.aiSummary}
                                                </p>
                                            </div>
                                            {item.aiWatchNext && (
                                                <div className="text-[10px] text-moncchichi-textSec pl-5 border-l-2 border-moncchichi-border ml-1 mt-1">
                                                    <span className="uppercase font-bold text-moncchichi-accent/70">Watch: </span> 
                                                    {item.aiWatchNext}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {!item.aiSummary && !analyzingIds.has(item.id) && (
                                <button 
                                    onClick={() => handleAnalyze(item)}
                                    className="mt-2 text-[10px] font-bold text-moncchichi-accent flex items-center gap-1 hover:underline opacity-80 hover:opacity-100"
                                >
                                    <Sparkles size={10} /> Analyze Impact
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WatchlistNewsPanel;
