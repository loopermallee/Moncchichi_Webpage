
import React, { useRef, useState, useEffect } from 'react';
import { Loader2, AudioLines, Music, Play, Pause } from 'lucide-react';
import { Book, bookService } from '../../services/bookService';

const AudioPlayer = ({ book }: { book: Book }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [src, setSrc] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!book.pdfAssetId) return;
        
        let url: string | null = null;
        bookService.getPdfBlob(book.pdfAssetId).then(blob => {
            if (blob) {
                url = URL.createObjectURL(blob);
                setSrc(url);
                setLoading(false);
            }
        });

        return () => {
            if (url) URL.revokeObjectURL(url);
        };
    }, [book]);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) audioRef.current.pause();
            else audioRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setProgress(audioRef.current.currentTime);
            setDuration(audioRef.current.duration || 0);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setProgress(time);
        }
    };

    const formatTime = (time: number) => {
        const min = Math.floor(time / 60);
        const sec = Math.floor(time % 60);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col items-center justify-center h-full w-full p-8 bg-moncchichi-bg relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                <AudioLines size={300} className="text-moncchichi-accent animate-pulse" />
            </div>
            <div className={`w-64 h-64 bg-gradient-to-br from-moncchichi-surfaceAlt to-moncchichi-bg rounded-full border-4 border-moncchichi-border shadow-2xl flex items-center justify-center mb-12 relative ${isPlaying ? 'animate-spin-slow' : ''}`}>
                <div className="w-20 h-20 bg-moncchichi-bg rounded-full border-4 border-moncchichi-surfaceAlt flex items-center justify-center z-10">
                    <Music size={32} className="text-moncchichi-accent" />
                </div>
                <div className="absolute inset-2 border border-moncchichi-border/30 rounded-full"></div>
                <div className="absolute inset-8 border border-moncchichi-border/30 rounded-full"></div>
                <div className="absolute inset-16 border border-moncchichi-border/30 rounded-full"></div>
            </div>
            <div className="text-center mb-8 z-10">
                <h2 className="text-xl font-bold text-moncchichi-text mb-1 tracking-tight">{book.title}</h2>
                <p className="text-sm text-moncchichi-textSec font-mono uppercase tracking-widest">{book.author || "Unknown Artist"}</p>
            </div>
            {loading ? (
                <div className="flex items-center gap-2 text-moncchichi-accent">
                    <Loader2 size={24} className="animate-spin" />
                    <span className="text-sm font-bold">Loading Tape...</span>
                </div>
            ) : (
                <div className="w-full max-w-md z-10 space-y-4">
                    <audio 
                        ref={audioRef} 
                        src={src || undefined} 
                        onTimeUpdate={handleTimeUpdate} 
                        onEnded={() => setIsPlaying(false)}
                    />
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-moncchichi-textSec w-10 text-right">{formatTime(progress)}</span>
                        <input 
                            type="range" 
                            min="0" 
                            max={duration || 100} 
                            value={progress} 
                            onChange={handleSeek}
                            className="flex-1 h-2 bg-moncchichi-surfaceAlt rounded-full appearance-none cursor-pointer accent-moncchichi-accent"
                        />
                        <span className="text-xs font-mono text-moncchichi-textSec w-10">{formatTime(duration)}</span>
                    </div>
                    <div className="flex items-center justify-center gap-8">
                        <button 
                            onClick={togglePlay}
                            className="w-16 h-16 rounded-full bg-moncchichi-accent text-moncchichi-bg flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                        >
                            {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AudioPlayer;
