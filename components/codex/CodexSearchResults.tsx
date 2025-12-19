
import React, { useMemo } from 'react';
import { ProtocolMatch } from '../../services/protocolService';
import { FileSearch, FileText, ChevronRight } from 'lucide-react';
import { formatDisplayTitle } from './utils';

interface CodexSearchResultsProps {
    matches: ProtocolMatch[];
    isSearching: boolean;
    searchQuery: string;
    onMatchClick: (index: number) => void;
}

const CodexSearchResults: React.FC<CodexSearchResultsProps> = ({ matches, isSearching, searchQuery, onMatchClick }) => {
    const groupedMatches = useMemo(() => {
        const groups: { [key: string]: { id: string, title: string, count: number, firstIndex: number } } = {};
        
        matches.forEach((m, idx) => {
            if (!groups[m.bookId]) {
                groups[m.bookId] = {
                    id: m.bookId,
                    title: m.bookTitle,
                    count: 0,
                    firstIndex: idx
                };
            }
            groups[m.bookId].count++;
        });
        
        return Object.values(groups);
    }, [matches]);

    if (groupedMatches.length > 0) {
        return (
            <div className="space-y-3 animate-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between px-1">
                    <div className="text-xs font-bold text-moncchichi-textSec uppercase tracking-wider">Found in {groupedMatches.length} File{groupedMatches.length !== 1 ? 's' : ''}</div>
                    <div className="text-[10px] text-moncchichi-textSec font-mono bg-moncchichi-surfaceAlt px-2 py-0.5 rounded">{matches.length} Total Matches</div>
                </div>
                {groupedMatches.map((group) => (
                    <div key={group.id} onClick={() => onMatchClick(group.firstIndex)} className="bg-moncchichi-surface border border-moncchichi-border p-4 rounded-xl cursor-pointer hover:border-moncchichi-accent/50 transition-all group relative overflow-hidden shadow-sm hover:shadow-md active:scale-[0.99] animate-in fade-in">
                        <div className="flex items-start gap-3">
                            <div className="p-3 bg-moncchichi-surfaceAlt rounded-lg text-moncchichi-accent shrink-0 border border-moncchichi-border/30">
                                <FileText size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-bold text-sm text-moncchichi-text truncate pr-2">{formatDisplayTitle(group.title)}</h4>
                                    <span className="text-[10px] bg-moncchichi-accent/10 text-moncchichi-accent px-2 py-0.5 rounded font-bold whitespace-nowrap border border-moncchichi-accent/20">{group.count} Hits</span>
                                </div>
                            </div>
                            <div className="self-center text-moncchichi-textSec opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronRight size={16} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (!isSearching && searchQuery) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-moncchichi-textSec opacity-50 gap-3">
                <FileSearch size={32} />
                <p className="text-sm">No matches found in Codex.</p>
            </div>
        );
    }

    return null;
};

export default CodexSearchResults;
