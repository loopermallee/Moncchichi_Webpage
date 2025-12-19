
import React, { useState, useEffect, useRef } from 'react';
import { ICONS } from '../constants';
import { weaverService, WeaverJob } from '../services/weaverService';
import { Upload, Link, FileVideo, FileAudio, Loader2, CheckCircle, AlertTriangle, X, ChevronRight, Terminal, MessageSquare, Play } from 'lucide-react';

const MAX_FILE_BYTES = 1024 * 1024 * 1024; // 1GB

const QuantumWeaver: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [activeJobs, setActiveJobs] = useState<WeaverJob[]>([]);
    const [history, setHistory] = useState<WeaverJob[]>([]);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [urlInput, setUrlInput] = useState("");
    const [isUrlInputVisible, setIsUrlInputVisible] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const refresh = () => {
            setActiveJobs(weaverService.getActiveJobs());
            setHistory(weaverService.getHistory());
        };
        
        refresh();
        const unsub = weaverService.subscribe(refresh);
        return unsub;
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files) as File[];
            let tooLarge = false;
            
            files.forEach(f => {
                if (f.size > MAX_FILE_BYTES) {
                    tooLarge = true;
                } else {
                    weaverService.startJob(f);
                }
            });

            if (tooLarge) alert(`Some files skipped > 1GB.`);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleUrlSubmit = () => {
        if (!urlInput.trim()) return;
        try {
            weaverService.startJobFromUrl(urlInput.trim());
            setUrlInput("");
            setIsUrlInputVisible(false);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'COMPLETE': return 'text-moncchichi-success';
            case 'ERROR': return 'text-moncchichi-error';
            case 'UPLOADING': return 'text-moncchichi-accent';
            case 'PROCESSING': return 'text-blue-400';
            case 'ANALYZING': return 'text-purple-400';
            default: return 'text-moncchichi-textSec';
        }
    };

    const getIcon = (type: string) => {
        if (type.includes('audio')) return <FileAudio size={20} />;
        return <FileVideo size={20} />;
    };

    const renderJobCard = (job: WeaverJob) => {
        const isSelected = selectedJobId === job.id;
        const statusColor = getStatusColor(job.status);

        return (
            <div 
                key={job.id} 
                onClick={() => setSelectedJobId(isSelected ? null : job.id)}
                className={`bg-moncchichi-surface border ${isSelected ? 'border-moncchichi-accent' : 'border-moncchichi-border'} rounded-xl overflow-hidden transition-all mb-3 cursor-pointer shadow-sm`}
            >
                <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-moncchichi-surfaceAlt ${statusColor}`}>
                                {getIcon(job.fileType)}
                            </div>
                            <div>
                                <div className="font-bold text-sm text-moncchichi-text truncate max-w-[200px]">{job.fileName}</div>
                                <div className="flex items-center gap-2 text-[10px] text-moncchichi-textSec font-mono">
                                    <span>{(job.fileSize / 1024 / 1024).toFixed(1)} MB</span>
                                    <span>•</span>
                                    <span className={statusColor}>{job.status}</span>
                                </div>
                            </div>
                        </div>
                        {job.status === 'COMPLETE' ? (
                            <CheckCircle size={18} className="text-moncchichi-success" />
                        ) : job.status === 'ERROR' ? (
                            <AlertTriangle size={18} className="text-moncchichi-error" />
                        ) : (
                            <Loader2 size={18} className="animate-spin text-moncchichi-accent" />
                        )}
                    </div>

                    {/* Progress Bar */}
                    {(job.status !== 'COMPLETE' && job.status !== 'ERROR' && job.status !== 'IDLE') && (
                        <div className="w-full bg-moncchichi-surfaceAlt h-1.5 rounded-full overflow-hidden mb-2">
                            <div 
                                className="h-full bg-moncchichi-accent transition-all duration-300 ease-out relative"
                                style={{ width: `${job.progress}%` }}
                            >
                                <div className="absolute inset-0 bg-white/30 w-full animate-[shimmer_1s_infinite_linear]" style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }} />
                            </div>
                        </div>
                    )}

                    <div className="text-xs text-moncchichi-textSec italic truncate">
                        {job.message}
                    </div>
                </div>

                {/* Expanded Details */}
                {isSelected && (
                    <div className="border-t border-moncchichi-border bg-moncchichi-surfaceAlt/20 p-4 animate-in slide-in-from-top-2">
                        {job.status === 'ERROR' && (
                            <div className="bg-moncchichi-error/10 border border-moncchichi-error/30 p-3 rounded-lg text-xs text-moncchichi-error mb-3 font-mono">
                                FATAL: {job.error}
                            </div>
                        )}

                        {job.result ? (
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-[10px] font-bold text-moncchichi-accent uppercase tracking-wider mb-1">Summary</h4>
                                    <p className="text-sm text-moncchichi-text leading-relaxed whitespace-pre-wrap">{job.result.summary}</p>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-bold text-moncchichi-accent uppercase tracking-wider mb-1">Key Points</h4>
                                    <ul className="list-disc list-inside text-xs text-moncchichi-textSec space-y-1">
                                        {job.result.keyPoints.map((kp, i) => (
                                            <li key={i}>{kp}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="text-[10px] text-moncchichi-textSec opacity-50 text-right">
                                    Method: {job.result.method}
                                </div>
                            </div>
                        ) : (
                            <div className="font-mono text-[10px] text-moncchichi-textSec bg-black/40 p-3 rounded-lg max-h-32 overflow-y-auto">
                                {job.logs.map((log, i) => (
                                    <div key={i} className="mb-0.5">{log}</div>
                                ))}
                            </div>
                        )}
                        
                        <div className="flex justify-end gap-2 mt-4">
                            <button 
                                onClick={(e) => { e.stopPropagation(); weaverService.deleteHistoryItem(job.id); setSelectedJobId(null); }}
                                className="px-3 py-1.5 text-xs text-moncchichi-error border border-moncchichi-error/30 rounded-lg hover:bg-moncchichi-error/10 transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-moncchichi-bg">
            <div className="px-4 py-3 border-b border-moncchichi-border bg-moncchichi-surface flex items-center gap-3 sticky top-0 z-20 shadow-sm">
                <button onClick={onBack} className="p-2 -ml-2 text-moncchichi-textSec hover:text-moncchichi-text rounded-full hover:bg-moncchichi-surfaceAlt transition-colors">
                    {ICONS.Back}
                </button>
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-moncchichi-text tracking-tight flex items-center gap-2">
                        {ICONS.Quantum} Quantum Weaver
                    </h2>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsUrlInputVisible(!isUrlInputVisible)}
                        className={`p-2 rounded-full transition-colors ${isUrlInputVisible ? 'bg-moncchichi-accent text-moncchichi-bg' : 'text-moncchichi-textSec hover:text-moncchichi-text bg-moncchichi-surfaceAlt'}`}
                    >
                        <Link size={18} />
                    </button>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 bg-moncchichi-accent text-moncchichi-bg rounded-full shadow-lg shadow-moncchichi-accent/20 active:scale-95 transition-transform"
                    >
                        <Upload size={18} />
                    </button>
                </div>
            </div>

            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                className="hidden" 
                multiple 
                accept="video/*,audio/*"
            />

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                {isUrlInputVisible && (
                    <div className="flex gap-2 animate-in slide-in-from-top-2 fade-in">
                        <input 
                            type="text" 
                            value={urlInput}
                            onChange={e => setUrlInput(e.target.value)}
                            placeholder="Paste direct media URL..."
                            className="flex-1 bg-moncchichi-surface border border-moncchichi-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-moncchichi-accent"
                            onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
                        />
                        <button 
                            onClick={handleUrlSubmit}
                            disabled={!urlInput.trim()}
                            className="bg-moncchichi-accent text-moncchichi-bg px-4 rounded-xl font-bold text-sm disabled:opacity-50"
                        >
                            Weave
                        </button>
                    </div>
                )}

                {activeJobs.length === 0 && history.length === 0 && !isUrlInputVisible && (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50 text-moncchichi-textSec gap-4 text-center">
                        <div className="p-4 bg-moncchichi-surfaceAlt rounded-full border border-moncchichi-border">
                            {ICONS.Quantum}
                        </div>
                        <div>
                            <h3 className="font-bold mb-1">No Active Threads</h3>
                            <p className="text-xs max-w-xs">Upload audio or video files to extract wisdom using the Quantum Weaver engine.</p>
                        </div>
                    </div>
                )}

                {activeJobs.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-moncchichi-textSec uppercase tracking-wider mb-2">Processing</h3>
                        {activeJobs.map(renderJobCard)}
                    </div>
                )}

                {history.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-moncchichi-textSec uppercase tracking-wider mb-2">Archives</h3>
                        {history.map(renderJobCard)}
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuantumWeaver;
