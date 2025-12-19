
import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Download, BookOpen, Award, FileText, Music, ImageOff, Globe } from 'lucide-react';
import { bookService } from '../../services/bookService';

// --- Shared Components ---

export const CuteLoading = ({ label = "Loading...", icon }: { label?: string, icon?: React.ReactNode }) => (
    <div className="flex flex-col items-center justify-center py-8 animate-in fade-in zoom-in-95">
        <div className="relative mb-3">
            <div className="absolute inset-0 bg-moncchichi-accent blur-xl opacity-20 rounded-full animate-pulse"></div>
            <div className="relative bg-moncchichi-surfaceAlt border border-moncchichi-accent/30 p-4 rounded-full shadow-lg animate-bounce text-moncchichi-accent">
                {icon || <Loader2 size={32} className="animate-spin" />}
            </div>
        </div>
        <span className="text-xs font-bold text-moncchichi-textSec animate-pulse">{label}</span>
    </div>
);

export const BookSkeleton = () => (
    <div className="flex gap-4 bg-moncchichi-surface border border-moncchichi-border p-3 rounded-xl animate-pulse">
        <div className="w-20 aspect-[2/3] bg-moncchichi-surfaceAlt rounded-lg border border-moncchichi-border/30"></div>
        <div className="flex-1 flex flex-col justify-between py-1">
            <div className="space-y-2">
                <div className="h-4 bg-moncchichi-surfaceAlt rounded w-3/4"></div>
                <div className="h-3 bg-moncchichi-surfaceAlt rounded w-1/2"></div>
            </div>
            <div className="flex justify-between items-end border-t border-moncchichi-border/30 pt-2">
                <div className="h-4 bg-moncchichi-surfaceAlt rounded w-16"></div>
                <div className="h-6 bg-moncchichi-surfaceAlt rounded w-16"></div>
            </div>
        </div>
    </div>
);

export const TransitionOverlay = ({ title }: { title: string }) => (
    <div className="absolute inset-0 z-[100] bg-moncchichi-bg/95 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
        <div className="relative">
            <div className="absolute inset-0 bg-moncchichi-accent blur-xl opacity-20 rounded-full animate-pulse"></div>
            <div className="relative bg-moncchichi-surfaceAlt border border-moncchichi-accent/30 p-6 rounded-full shadow-2xl animate-bounce text-moncchichi-accent">
                <Download size={48} />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-moncchichi-bg rounded-full p-1 border border-moncchichi-accent">
                <Loader2 size={20} className="animate-spin text-moncchichi-text" />
            </div>
        </div>
        <h3 className="text-lg font-bold text-moncchichi-text mt-6 animate-pulse">Acquiring Scroll...</h3>
        <p className="text-sm text-moncchichi-textSec font-mono mt-2 max-w-xs text-center leading-relaxed">
            {title}
        </p>
        <div className="mt-6 w-48 h-1 bg-moncchichi-surfaceAlt rounded-full overflow-hidden">
            <div className="h-full bg-moncchichi-accent w-full animate-[shimmer_1.5s_infinite_linear] -translate-x-full" style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }}></div>
        </div>
    </div>
);

export const ChapterAnnouncement = ({ title }: { title: string }) => (
    <div className="absolute top-20 left-0 w-full flex justify-center pointer-events-none z-[60] animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-black/70 backdrop-blur-md border border-moncchichi-accent/40 px-6 py-3 rounded-full shadow-[0_0_20px_rgba(166,145,242,0.2)] flex items-center gap-3">
            <div className="bg-moncchichi-accent text-moncchichi-bg p-1 rounded-full">
                <BookOpen size={12} fill="currentColor" />
            </div>
            <span className="text-sm font-bold text-white tracking-wide">{title}</span>
        </div>
    </div>
);

export const EndOfSeriesOverlay = ({ onBack, onReplay }: { onBack: () => void, onReplay: () => void }) => (
    <div className="absolute inset-0 z-[100] bg-gradient-to-b from-black/80 via-black/90 to-black flex flex-col items-center justify-center p-8 animate-in zoom-in-95 duration-300 text-center">
        <div className="mb-6 p-4 rounded-full bg-moncchichi-surface border-2 border-moncchichi-accent/50 shadow-[0_0_30px_rgba(166,145,242,0.2)]">
            <Award size={48} className="text-moncchichi-accent" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Journey Complete</h2>
        <p className="text-moncchichi-textSec text-sm mb-8 max-w-xs leading-relaxed">
            You have reached the end of the available scrolls for this series.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
            <button 
                onClick={(e) => { e.stopPropagation(); onBack(); }} 
                className="w-full py-3 bg-moncchichi-accent text-moncchichi-bg font-bold rounded-xl hover:scale-105 transition-transform shadow-lg"
            >
                Return to Codex
            </button>
            <button 
                onClick={(e) => { e.stopPropagation(); onReplay(); }} 
                className="w-full py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors border border-white/10"
            >
                Read from Beginning
            </button>
        </div>
    </div>
);

export const CoverImage = React.memo(({ url, title, className }: { url?: string; title: string; className?: string }) => {
    const [imgSrc, setImgSrc] = useState<string | undefined>(url);
    const [status, setStatus] = useState<'LOADING' | 'LOADED' | 'ERROR'>('LOADING');
    const [isSubstitute, setIsSubstitute] = useState(false);

    useEffect(() => {
        setImgSrc(url);
        setStatus('LOADING');
        setIsSubstitute(false);
    }, [url]);

    const handleError = useCallback(() => {
        if (isSubstitute) {
            setStatus('ERROR');
            return;
        }
        setStatus('LOADING');
        bookService.findSubstituteCover(title).then(subUrl => {
            if (subUrl) {
                setImgSrc(subUrl);
                setIsSubstitute(true);
            } else {
                setStatus('ERROR');
            }
        });
    }, [title, isSubstitute]);

    useEffect(() => {
        if (!url && !isSubstitute && status !== 'ERROR') {
            handleError();
        }
    }, [url, isSubstitute, status, handleError]);

    if (status === 'ERROR') {
        return (
            <div className={`flex flex-col items-center justify-center bg-moncchichi-surfaceAlt border border-moncchichi-border/30 p-2 text-center ${className}`}>
                <div className="p-2 bg-moncchichi-bg rounded-full mb-1 opacity-50">
                    {title.endsWith('.pdf') ? <FileText size={20} className="text-moncchichi-textSec"/> : 
                     (title.match(/\.(mp3|ogg|wav)$/i) ? <Music size={20} className="text-moncchichi-accent"/> : <ImageOff size={20} className="text-moncchichi-textSec" />)}
                </div>
                <span className="text-[9px] text-moncchichi-textSec font-bold line-clamp-2 leading-tight opacity-70">
                    {title}
                </span>
            </div>
        );
    }

    return (
        <div className={`relative ${className}`}>
            <img 
                src={imgSrc} 
                alt={title} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={handleError}
                onLoad={() => setStatus('LOADED')}
            />
            {status === 'LOADING' && (
                <div className="absolute inset-0 flex items-center justify-center bg-moncchichi-surfaceAlt animate-pulse">
                    <Loader2 size={16} className="text-moncchichi-textSec animate-spin" />
                </div>
            )}
        </div>
    );
});
