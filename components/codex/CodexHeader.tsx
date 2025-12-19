
import React from 'react';
import { ICONS } from '../../constants';
import { Upload } from 'lucide-react';

interface CodexHeaderProps {
    onBack: () => void;
    onUploadClick: () => void;
}

const CodexHeader: React.FC<CodexHeaderProps> = ({ onBack, onUploadClick }) => {
    return (
        <div className="px-4 py-3 border-b border-moncchichi-border bg-moncchichi-surface flex items-center gap-3 sticky top-0 z-20 shadow-sm">
            <button onClick={onBack} className="p-2 -ml-2 text-moncchichi-textSec hover:text-moncchichi-text rounded-full hover:bg-moncchichi-surfaceAlt transition-colors">
                {ICONS.Back}
            </button>
            <div className="flex-1">
                <h2 className="text-lg font-bold text-moncchichi-text tracking-tight flex items-center gap-2">
                    {ICONS.Codex} Codex
                </h2>
            </div>
            <button 
                onClick={onUploadClick} 
                className="p-2 bg-moncchichi-accent text-moncchichi-bg rounded-full shadow-lg shadow-moncchichi-accent/20 active:scale-95 transition-transform"
            >
                <Upload size={18} />
            </button>
        </div>
    );
};

export default CodexHeader;
