
import React from 'react';
import { Search, Loader2, X } from 'lucide-react';

interface CodexSearchBarProps {
    value: string;
    onChange: (val: string) => void;
    isSearching: boolean;
}

const CodexSearchBar: React.FC<CodexSearchBarProps> = ({ value, onChange, isSearching }) => {
    return (
        <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-moncchichi-textSec pointer-events-none">
                <Search size={16} />
            </div>
            <input 
                type="text" 
                value={value} 
                onChange={(e) => onChange(e.target.value)} 
                placeholder="SEARCH PDF CONTENT..." 
                className="w-full bg-moncchichi-surfaceAlt/50 border border-moncchichi-border rounded-xl pl-10 pr-10 py-3 text-sm font-mono uppercase focus:outline-none focus:border-moncchichi-accent text-moncchichi-text shadow-sm placeholder-moncchichi-textSec/50 transition-all focus:bg-moncchichi-surface" 
            />
            {isSearching ? ( 
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 size={18} className="animate-spin text-moncchichi-accent" />
                </div> 
            ) : value ? ( 
                <button onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-moncchichi-textSec hover:text-moncchichi-text p-1">
                    <X size={16} />
                </button> 
            ) : null}
        </div>
    );
};

export default CodexSearchBar;
