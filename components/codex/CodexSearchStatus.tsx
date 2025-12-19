
import React from 'react';
import { Sparkles, CheckCircle, X } from 'lucide-react';

export interface ScanProgressItem {
    name: string;
    status: 'scanning' | 'empty' | 'found';
}

interface CodexSearchStatusProps {
    isSearching: boolean;
    scanProgress: ScanProgressItem[];
}

const CodexSearchStatus: React.FC<CodexSearchStatusProps> = ({ isSearching, scanProgress }) => {
    if (!isSearching) return null;

    return (
        <div className="bg-gradient-to-r from-moncchichi-accent/20 to-transparent p-4 rounded-xl border border-moncchichi-accent/30 animate-in fade-in slide-in-from-top-2 flex flex-col gap-2">
            <div className="flex items-center gap-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-moncchichi-accent/30 blur-lg rounded-full animate-pulse"></div>
                    <div className="relative bg-moncchichi-bg rounded-full p-2 border border-moncchichi-accent/50 shadow-lg animate-bounce">
                        <Sparkles size={24} className="text-moncchichi-accent" />
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-moncchichi-text animate-pulse">Ershin is reading...</h3>
                </div>
            </div>
            {/* Scanned Files List */}
            <div className="pl-14 space-y-1">
                {scanProgress.slice(-5).map((item, i) => ( 
                    <div 
                        key={item.name + i} 
                        className={`text-xs truncate flex items-center gap-2 transition-all duration-1000 ${item.status !== 'scanning' ? 'text-moncchichi-textSec/50 animate-out fade-out' : 'text-moncchichi-textSec animate-in slide-in-from-left-2'}`}
                    >
                        {item.status === 'scanning' && <div className="w-1.5 h-1.5 rounded-full bg-moncchichi-accent/50 animate-pulse" />}
                        {item.status === 'empty' && <X size={10} className="text-moncchichi-error" />}
                        {item.status === 'found' && <CheckCircle size={10} className="text-moncchichi-success" />}
                        <span className={item.status === 'empty' ? 'line-through decoration-moncchichi-error/50' : ''}>{item.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CodexSearchStatus;
