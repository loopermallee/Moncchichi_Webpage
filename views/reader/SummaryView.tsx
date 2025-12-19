
import React, { useState } from 'react';
import { Book, Chapter, bookService } from '../../services/bookService';
import { CoverImage, BookSkeleton } from '../../components/reader/ReaderShared';
import { ArrowLeft, Bookmark, Image, AlertTriangle, Globe, BookOpen, Download, FileText, ChevronUp, ChevronDown, Sparkles, Loader2, List, CheckCircle, EyeOff, Eye } from 'lucide-react';

interface SummaryViewProps {
    book: Book | null;
    chapterList: Chapter[];
    loadingChapters: boolean;
    aiReview: string;
    loadingReview: boolean;
    onBack: () => void;
    onRead: () => void;
    onDownloadAll: () => void;
    onChapterAction: (ch: Chapter, action: 'READ' | 'DOWNLOAD') => void;
    library: Book[];
    onTagClick: (tag: string) => void;
}

const SummaryView: React.FC<SummaryViewProps> = ({ 
    book, 
    chapterList, 
    loadingChapters, 
    aiReview, 
    loadingReview, 
    onBack, 
    onRead, 
    onDownloadAll, 
    onChapterAction, 
    library, 
    onTagClick 
}) => {
    const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);
    const isSpoiled = !loadingChapters && chapterList.length === 0;
    const onlyNonEnglish = chapterList.length > 0 && chapterList.every(c => c.language !== 'en');

    return (
        <div className="flex flex-col h-full bg-moncchichi-bg animate-in slide-in-from-right duration-300">
            <div className="absolute top-0 w-full p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent">
                <button onClick={onBack} className="p-2 bg-black/40 backdrop-blur rounded-full text-white border border-white/10 hover:bg-white/20 transition-colors">
                    <ArrowLeft size={20}/>
                </button>
                <button onClick={() => {}} className="p-2 bg-black/40 backdrop-blur rounded-full text-white border border-white/10 hover:bg-white/20 transition-colors">
                    <Bookmark size={20}/>
                </button>
            </div>

            <div className="relative h-64 w-full bg-moncchichi-surfaceAlt shrink-0">
                {book?.coverUrl ? (
                    <>
                    <img src={book.coverUrl} className="w-full h-full object-cover opacity-30 blur-md" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-gradient-to-t from-moncchichi-bg via-transparent to-transparent" />
                    <div className="absolute top-16 left-4 flex gap-4 right-4 items-end">
                        <CoverImage 
                            url={book.coverUrl} 
                            title={book.title} 
                            className="h-40 w-28 object-cover rounded-lg shadow-2xl border border-moncchichi-border/50"
                        />
                        <div className="flex-1 pb-1 drop-shadow-lg">
                                <h2 className="text-xl font-bold line-clamp-2 leading-tight mb-1 text-white">{book?.title}</h2>
                                <p className="text-sm text-moncchichi-primary opacity-90 mb-2 font-medium">{book?.author}</p>
                                <div className="flex gap-1.5 flex-wrap">
                                    {book?.tags?.slice(0, 3).map(t => (
                                        <button 
                                            key={t} 
                                            onClick={(e) => { e.stopPropagation(); onTagClick(t); }}
                                            className="px-2 py-0.5 bg-moncchichi-accent/20 border border-moncchichi-accent/30 rounded text-[10px] font-bold text-moncchichi-accent hover:bg-moncchichi-accent hover:text-moncchichi-bg transition-colors cursor-pointer"
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                        </div>
                    </div>
                    </>
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-pink-900/20"><Image size={64} className="text-pink-500 opacity-50" /></div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-10">
                {isSpoiled && (
                    <div className="mb-4 bg-moncchichi-error/10 border border-moncchichi-error/30 p-4 rounded-xl flex items-start gap-3 animate-in fade-in">
                        <AlertTriangle size={20} className="text-moncchichi-error shrink-0 mt-0.5" />
                        <div>
                            <h3 className="text-sm font-bold text-moncchichi-error mb-1">Source Broken / No Chapters</h3>
                            <p className="text-xs text-moncchichi-textSec leading-relaxed">
                                This manga entry appears to have no available chapters.
                            </p>
                        </div>
                    </div>
                )}

                {onlyNonEnglish && (
                    <div className="mb-4 bg-moncchichi-warning/10 border border-moncchichi-warning/30 p-3 rounded-xl flex items-center gap-3 animate-in fade-in">
                        <Globe size={20} className="text-moncchichi-warning shrink-0" />
                        <div className="text-xs text-moncchichi-text">
                            <strong>Foreign Language Only</strong><br/>
                            No English translation found. Showing other languages.
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-6">
                    <button 
                        onClick={onRead} 
                        disabled={isSpoiled}
                        className={`flex items-center justify-center gap-2 font-bold py-3 rounded-xl transition-all shadow-lg ${isSpoiled ? 'bg-moncchichi-surfaceAlt text-moncchichi-textSec opacity-50 cursor-not-allowed' : 'bg-moncchichi-accent text-moncchichi-bg hover:brightness-110 active:scale-95 shadow-moncchichi-accent/20'}`}
                    >
                        <BookOpen size={18} /> Start Reading
                    </button>
                    <button 
                        onClick={onDownloadAll} 
                        disabled={isSpoiled}
                        className={`flex items-center justify-center gap-2 border font-bold py-3 rounded-xl transition-all ${isSpoiled ? 'bg-moncchichi-surfaceAlt border-moncchichi-border text-moncchichi-textSec opacity-50 cursor-not-allowed' : 'bg-moncchichi-surface border-moncchichi-border text-moncchichi-text hover:bg-moncchichi-surfaceAlt active:scale-95'}`}
                    >
                        <Download size={18} /> Download All
                    </button>
                </div>

                <div className="text-sm text-moncchichi-textSec leading-relaxed mb-4 bg-moncchichi-surface/50 p-4 rounded-xl border border-moncchichi-border">
                    <h3 className="font-bold text-moncchichi-text uppercase text-xs mb-2 flex items-center gap-2 opacity-80">
                        <FileText size={14}/> Synopsis
                    </h3>
                    <div className={`transition-all duration-300 ${isSynopsisExpanded ? '' : 'line-clamp-6'}`}>
                        {book?.description || "No description available."}
                    </div>
                    {(book?.description?.length || 0) > 300 && (
                        <button onClick={() => setIsSynopsisExpanded(!isSynopsisExpanded)} className="mt-2 text-xs font-bold text-moncchichi-accent flex items-center gap-1 hover:underline">
                            {isSynopsisExpanded ? <>Show Less <ChevronUp size={12} /></> : <>Read More <ChevronDown size={12} /></>}
                        </button>
                    )}
                </div>

                {(aiReview || loadingReview) && (
                    <div className="mb-6 bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-4 rounded-xl border border-purple-500/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-10"><Sparkles size={40} className="text-purple-400" /></div>
                        <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Sparkles size={12} /> AI Insight
                        </h3>
                        {loadingReview ? (
                            <div className="flex items-center gap-2 text-xs text-moncchichi-textSec">
                                <Loader2 size={12} className="animate-spin" /> Analyzing reception...
                            </div>
                        ) : (
                            <p className="text-xs text-moncchichi-text leading-relaxed italic opacity-90">"{aiReview}"</p>
                        )}
                    </div>
                )}

                <div className="flex items-center justify-between mb-3 border-b border-moncchichi-border pb-2">
                    <h3 className="font-bold text-moncchichi-text uppercase text-sm flex items-center gap-2">
                        <List size={16}/> Chapters
                    </h3>
                    <span className="text-xs text-moncchichi-textSec font-mono bg-moncchichi-surfaceAlt px-2 py-0.5 rounded">{chapterList.length}</span>
                </div>

                {loadingChapters ? (
                    <div className="space-y-3"><BookSkeleton /><BookSkeleton /><BookSkeleton /></div>
                ) : (
                    <div className="space-y-2 pb-10">
                        {chapterList.map(ch => {
                            const isDownloaded = library.some(b => b.id === `${book?.id}-ch${ch.id}` && b.downloaded);
                            const isDownloading = library.some(b => b.id === `${book?.id}-ch${ch.id}` && b.isDownloading);
                            const isRead = bookService.isChapterRead(book?.id || '', ch.id);
                            
                            return (
                                <div key={ch.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${isRead ? 'bg-moncchichi-bg border-moncchichi-border/50 opacity-60' : 'bg-moncchichi-surface border-moncchichi-border hover:border-moncchichi-accent/50'}`}>
                                    <div className="flex-1 min-w-0 mr-4 cursor-pointer" onClick={() => onChapterAction(ch, 'READ')}>
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="bg-moncchichi-surfaceAlt border border-moncchichi-border/50 rounded px-1.5 text-[9px] font-bold text-moncchichi-textSec font-mono">#{ch.sequence}</span>
                                            {ch.language !== 'en' && (
                                                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1 rounded uppercase font-bold text-[9px]">{ch.language}</span>
                                            )}
                                            <div className={`font-bold text-sm truncate transition-colors ${isRead ? 'text-moncchichi-textSec' : 'text-moncchichi-text'}`}>{ch.title}</div>
                                        </div>
                                        <div className="text-[10px] text-moncchichi-textSec flex items-center gap-2">
                                            <span>{ch.pages} pages</span>
                                            {isRead && <span className="text-moncchichi-success font-bold flex items-center gap-0.5"><CheckCircle size={10}/> Read</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); onChapterAction(ch, 'READ'); }} className={`p-2 rounded-full transition-colors ${isRead ? 'text-moncchichi-textSec hover:text-moncchichi-text' : 'text-moncchichi-text hover:text-moncchichi-accent'}`}>
                                            {isRead ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                        {isDownloaded ? (
                                            <div className="p-2 text-moncchichi-success"><CheckCircle size={16} /></div>
                                        ) : isDownloading ? (
                                            <div className="p-2"><Loader2 size={16} className="animate-spin text-moncchichi-accent"/></div>
                                        ) : (
                                            <button onClick={(e) => { e.stopPropagation(); onChapterAction(ch, 'DOWNLOAD'); }} className="p-2 bg-moncchichi-surfaceAlt rounded-lg text-moncchichi-textSec hover:text-moncchichi-text border border-moncchichi-border active:scale-95">
                                                <Download size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SummaryView;
