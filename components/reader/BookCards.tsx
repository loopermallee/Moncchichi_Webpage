
import React, { useState } from 'react';
import { Book, bookService } from '../../services/bookService';
import { CoverImage } from './ReaderShared';
import { CheckCircle, AlertTriangle, Edit2, Play, BookOpen, List, Globe, Download, Sparkles } from 'lucide-react';

export const SOURCE_STYLES: Record<string, { bg: string, text: string, border: string, label: string }> = {
    'MANGADEX': { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500', label: 'MangaDex' },
    'COMICK': { bg: 'bg-indigo-500/10', text: 'text-indigo-500', border: 'border-indigo-500', label: 'Comick' },
    'MANGAKAKALOT': { bg: 'bg-green-600/10', text: 'text-green-600', border: 'border-green-600', label: 'MangaKakalot' },
    'STANDARD_EBOOKS': { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500', label: 'Standard' },
    'OPEN_LIBRARY': { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500', label: 'OpenLib' },
    'INTERNET_ARCHIVE': { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500', label: 'Archive' },
    'GOOGLE': { bg: 'bg-blue-400/10', text: 'text-blue-400', border: 'border-blue-400', label: 'Google' },
    'NLB': { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500', label: 'NLB' },
    'LOCAL': { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500', label: 'Local' },
    'GUTENBERG': { bg: 'bg-green-500/10', text: 'text-green-500', border: 'border-green-500', label: 'Gutenberg' },
    'LIBGEN': { bg: 'bg-cyan-500/10', text: 'text-cyan-500', border: 'border-cyan-500', label: 'LibGen' },
    'CONSUMET': { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500', label: 'Consumet' }
};

export const DiscoveryCard = React.memo(({ book, onClick }: { book: Book, onClick: (b: Book) => void }) => {
    return (
        <div onClick={() => onClick(book)} className="shrink-0 w-28 cursor-pointer group snap-start">
            <div className="w-28 h-40 bg-moncchichi-surfaceAlt rounded-xl mb-2 overflow-hidden border border-moncchichi-border relative shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:shadow-moncchichi-accent/20">
                <CoverImage url={book.coverUrl} title={book.title} className="w-full h-full object-cover" />
                <div className="absolute bottom-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-[9px] text-white font-bold backdrop-blur-sm border border-white/10 tracking-wide">
                    {SOURCE_STYLES[book.source]?.label || book.source}
                </div>
                {book.downloaded && (
                    <div className="absolute top-1 right-1 bg-moncchichi-success/90 rounded-full p-0.5 shadow-sm">
                        <CheckCircle size={10} className="text-white" />
                    </div>
                )}
                {book.isMetadataAiGenerated && (
                    <div className="absolute top-1 left-1 bg-purple-500/90 rounded-full p-0.5 shadow-sm" title="AI Enhanced Metadata">
                        <Sparkles size={10} className="text-white" />
                    </div>
                )}
            </div>
            <div className="px-0.5">
                <div className="text-xs font-bold line-clamp-2 leading-tight group-hover:text-moncchichi-accent transition-colors">{book.title}</div>
                <div className="text-[10px] text-moncchichi-textSec truncate mt-0.5 opacity-80">{book.author}</div>
            </div>
        </div>
    );
});

export const BookListCard = React.memo(({ book, onClick, onUpdateCategory, categories }: { book: Book, onClick: (b: Book) => void, onUpdateCategory?: (id: string, cat: string) => void, categories?: string[] }) => {
    const isManga = book.type === 'MANGA';
    const isPdf = book.type === 'PDF';
    const isAudio = book.type === 'AUDIO';
    const seriesId = isManga ? bookService.getSeriesId(book.id) : book.id;
    const downloadedCount = isManga ? bookService.getDownloadedChapterCount(seriesId) : (book.downloaded ? 1 : 0);
    const style = SOURCE_STYLES[book.source] || { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500', label: book.source };
    const [showCatMenu, setShowCatMenu] = useState(false);

    const handleActionClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if ((book.type === 'BOOK' || book.type === 'PDF') && !book.downloaded && (book.source === 'GUTENBERG' || book.source === 'STANDARD_EBOOKS' || book.source === 'OPEN_LIBRARY' || book.source === 'INTERNET_ARCHIVE')) {
            bookService.downloadBook(book);
            return;
        }
        onClick(book);
    };

    return (
        <div 
            onClick={() => onClick(book)} 
            className={`flex gap-4 bg-moncchichi-surface border-y border-r border-l-4 ${style.border} border-moncchichi-border/50 p-3 rounded-xl cursor-pointer hover:bg-moncchichi-surfaceAlt/30 transition-all group relative overflow-hidden`}
        >
            <div className="w-20 aspect-[2/3] bg-moncchichi-surfaceAlt rounded-lg overflow-hidden shrink-0 relative shadow-sm border border-moncchichi-border/30">
                <CoverImage 
                    url={book.coverUrl} 
                    title={book.title} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {((isManga && downloadedCount > 0) || (!isManga && book.downloaded)) && (
                    <div className="absolute top-1 right-1 bg-moncchichi-success/90 rounded-full p-0.5 shadow-sm">
                        <CheckCircle size={10} className="text-white" />
                    </div>
                )}
                {book.isSpoiled && (
                    <div className="absolute top-1 left-1 bg-moncchichi-error text-moncchichi-bg rounded-full p-1 z-20 shadow-sm" title="No Chapters">
                        <AlertTriangle size={12} fill="currentColor" />
                    </div>
                )}
                {book.isMetadataAiGenerated && (
                    <div className={`absolute ${book.isSpoiled ? 'top-6' : 'top-1'} left-1 bg-purple-500/90 rounded-full p-1 z-20 shadow-sm`} title="AI Enhanced Metadata">
                        <Sparkles size={10} className="text-white" />
                    </div>
                )}
                {onUpdateCategory && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); setShowCatMenu(!showCatMenu); }}
                        className="absolute bottom-1 right-1 bg-black/60 p-1 rounded-full text-white opacity-70 hover:opacity-100 transition-opacity"
                    >
                        <Edit2 size={10} />
                    </button>
                )}
                {showCatMenu && categories && (
                    <div className="absolute top-0 left-0 w-full h-full bg-moncchichi-surfaceAlt/95 z-30 p-2 overflow-y-auto flex flex-col gap-1" onClick={e => e.stopPropagation()}>
                        <span className="text-[9px] font-bold text-moncchichi-textSec mb-1">Move to:</span>
                        {categories.map(cat => (
                            <button 
                                key={cat} 
                                onClick={() => { onUpdateCategory && onUpdateCategory(book.id, cat); setShowCatMenu(false); }}
                                className="text-[9px] text-left px-2 py-1 bg-moncchichi-bg border border-moncchichi-border rounded hover:border-moncchichi-accent text-moncchichi-text truncate"
                            >
                                {cat}
                            </button>
                        ))}
                        <button 
                            onClick={() => { onUpdateCategory && onUpdateCategory(book.id, 'Unlisted'); setShowCatMenu(false); }}
                            className="text-[9px] text-left px-2 py-1 bg-moncchichi-bg border border-moncchichi-border rounded hover:border-moncchichi-text text-moncchichi-textSec italic"
                        >
                            Unlisted
                        </button>
                    </div>
                )}
            </div>
            
            <div className="flex-1 min-w-0 flex flex-col justify-between py-1 z-10">
                <div>
                    <h4 className="font-bold text-sm text-moncchichi-text line-clamp-2 leading-tight mb-1 group-hover:text-moncchichi-accent transition-colors">{book.title}</h4>
                    <p className="text-xs text-moncchichi-textSec line-clamp-1">{book.author}</p>
                </div>

                <div className="flex flex-col gap-2.5">
                    {!isManga && book.progress > 0 && (
                        <div className="w-full bg-moncchichi-surfaceAlt h-1 rounded-full overflow-hidden">
                            <div className="bg-moncchichi-accent h-full transition-all duration-500" style={{ width: `${book.progress}%` }}></div>
                        </div>
                    )}

                    {book.tags && book.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {book.tags.slice(0, 3).map((tag, i) => (
                                <span key={i} className="text-[9px] font-bold text-moncchichi-textSec bg-moncchichi-surfaceAlt/80 px-2 py-0.5 rounded-[4px] border border-moncchichi-border/50 truncate max-w-[100px]">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="flex justify-between items-end border-t border-moncchichi-border/30 pt-2 mt-auto">
                        <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded ${style.bg} ${style.text} mb-0.5`}>
                            {style.label}
                        </span>
                        
                        {book.isDownloading ? (
                            <div className="flex items-center gap-2 bg-moncchichi-surfaceAlt px-2 py-1 rounded-lg border border-moncchichi-border/50">
                                <div className="w-4 h-4 rounded-full border-2 border-moncchichi-accent border-t-transparent animate-spin"/>
                                <span className="text-[10px] font-bold text-moncchichi-accent">{book.downloadProgress || 0}%</span>
                            </div>
                        ) : (
                            <button 
                            onClick={handleActionClick}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all active:scale-95 ${
                                (isManga && downloadedCount > 0) || book.downloaded
                                ? 'bg-moncchichi-success/10 border-moncchichi-success/30 text-moncchichi-success hover:bg-moncchichi-success/20'
                                : 'bg-moncchichi-surfaceAlt border-moncchichi-border text-moncchichi-textSec hover:text-moncchichi-text hover:border-moncchichi-textSec'
                            }`}
                            >
                                {(isManga && downloadedCount > 0) || book.downloaded ? (
                                    <>
                                        {isAudio ? <Play size={12} fill="currentColor" /> : <BookOpen size={12} />}
                                        <span className="text-[10px] font-bold">
                                            {isManga ? `${downloadedCount} Ch.` : (isAudio ? 'Play' : (isPdf ? 'View PDF' : (book.progress > 0 ? 'Resume' : 'Read')))}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        {(book.type === 'BOOK' || book.type === 'PDF') && (book.source === 'GUTENBERG' || book.source === 'STANDARD_EBOOKS' || book.source === 'OPEN_LIBRARY' || book.source === 'INTERNET_ARCHIVE') ? <Download size={12} /> : (isManga ? <List size={12}/> : <Globe size={12} />)}
                                        <span className="text-[10px] font-bold">
                                            {(book.type === 'BOOK' || book.type === 'PDF') && (book.source === 'GUTENBERG' || book.source === 'STANDARD_EBOOKS' || book.source === 'OPEN_LIBRARY' || book.source === 'INTERNET_ARCHIVE') ? 'Download' : (isManga ? 'Chapters' : 'Open')}
                                        </span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});
