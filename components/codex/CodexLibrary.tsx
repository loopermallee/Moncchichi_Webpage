
import React from 'react';
import { Book } from '../../services/bookService';
import { formatDisplayTitle, formatFileSize, getUploadDate, formatTimestamp } from './utils';
import { FolderPlus, Upload, CheckCircle, X, Edit2, Trash2, ChevronDown, ChevronUp, FileText, Move, Loader2, Sparkles, ArrowUp, ArrowDown, FileWarning, Copy } from 'lucide-react';

export interface DuplicateConflict {
    file: File;
    existingBook: Book;
    targetCategory?: string;
}

interface CodexLibraryProps {
    files: Book[];
    categories: string[];
    groupedFiles: Record<string, Book[]>;
    collapsedCategories: Record<string, boolean>;
    setCollapsedCategories: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    
    // Actions
    onFileClick: (book: Book) => void;
    onEnrichFile: (book: Book) => void;
    onMoveBook: (bookId: string, category: string) => void;
    onDeleteBook: (bookId: string) => void;
    
    // Category Management
    isAddingCategory: boolean;
    setIsAddingCategory: (v: boolean) => void;
    newCategoryName: string;
    setNewCategoryName: (v: string) => void;
    onAddCategory: () => void;
    
    editingCategory: string | null;
    setEditingCategory: (v: string | null) => void;
    renameValue: string;
    setRenameValue: (v: string) => void;
    onRenameCategory: (oldName: string) => void;
    onDeleteCategory: (name: string) => void;
    onMoveCategoryUp: (name: string) => void;
    onMoveCategoryDown: (name: string) => void;
    
    // Upload Helpers
    onUploadToCategory: (cat: string) => void;
    
    // State
    activeMoveMenu: string | null;
    setActiveMoveMenu: (v: string | null) => void;
    enrichingBookIds: Set<string>;
    
    // Conflict Modal
    conflictQueue: DuplicateConflict[];
    resolveConflict: (decision: 'REPLACE' | 'KEEP_BOTH' | 'SKIP') => void;
}

const CodexLibrary: React.FC<CodexLibraryProps> = (props) => {
    const {
        files, categories, groupedFiles, collapsedCategories, setCollapsedCategories,
        onFileClick, onEnrichFile, onMoveBook, onDeleteBook,
        isAddingCategory, setIsAddingCategory, newCategoryName, setNewCategoryName, onAddCategory,
        editingCategory, setEditingCategory, renameValue, setRenameValue, onRenameCategory, onDeleteCategory, onMoveCategoryUp, onMoveCategoryDown,
        onUploadToCategory, activeMoveMenu, setActiveMoveMenu, enrichingBookIds,
        conflictQueue, resolveConflict
    } = props;

    // Helper to ensure all categories including Unlisted are covered for display order
    const displayCategories = [...categories];
    if (!displayCategories.includes('Unlisted')) displayCategories.push('Unlisted');

    const renderConflictModal = () => {
        if (conflictQueue.length === 0) return null;
        const currentConflict = conflictQueue[0];
        const { file, existingBook } = currentConflict;
        
        return (
            <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-moncchichi-surface border border-moncchichi-border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                    <div className="p-4 border-b border-moncchichi-border bg-moncchichi-surfaceAlt/50 flex items-center gap-3">
                        <div className="p-2 bg-moncchichi-warning/10 rounded-full text-moncchichi-warning"><FileWarning size={20} /></div>
                        <h3 className="text-sm font-bold text-moncchichi-text">Duplicate Scroll Detected</h3>
                    </div>
                    <div className="p-6 space-y-6">
                        <p className="text-xs text-moncchichi-textSec text-center">A scroll named <span className="text-moncchichi-text font-bold">"{file.name}"</span> already exists in the Codex.</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-moncchichi-bg border border-moncchichi-border rounded-xl p-3 flex flex-col gap-1 opacity-70"><div className="text-[10px] font-bold text-moncchichi-textSec uppercase mb-1 text-center">Existing</div><div className="flex justify-center mb-2 text-moncchichi-textSec"><FileText size={24} /></div><div className="text-xs font-bold text-moncchichi-text truncate text-center">{existingBook.title}</div><div className="text-[10px] text-moncchichi-textSec text-center">{existingBook.description?.split('Size: ')[1] || 'Unknown Size'}</div><div className="text-[9px] text-moncchichi-textSec text-center mt-1">Added: {getUploadDate(existingBook.id)}</div></div>
                            <div className="bg-moncchichi-bg border border-moncchichi-accent/50 rounded-xl p-3 flex flex-col gap-1 relative"><div className="absolute -top-2 -right-2 bg-moncchichi-accent text-moncchichi-bg text-[9px] font-bold px-2 py-0.5 rounded-full">NEW</div><div className="text-[10px] font-bold text-moncchichi-accent uppercase mb-1 text-center">Incoming</div><div className="flex justify-center mb-2 text-moncchichi-accent"><Upload size={24} /></div><div className="text-xs font-bold text-moncchichi-text truncate text-center">{file.name.replace(/\.pdf$/i, '')}</div><div className="text-[10px] text-moncchichi-textSec text-center">{formatFileSize(file.size)}</div><div className="text-[9px] text-moncchichi-textSec text-center mt-1">Modified: {formatTimestamp(file.lastModified)}</div></div>
                        </div>
                    </div>
                    <div className="p-4 border-t border-moncchichi-border bg-moncchichi-surface flex flex-col gap-2">
                        <button onClick={() => resolveConflict('REPLACE')} className="w-full py-3 rounded-xl bg-moncchichi-error/10 text-moncchichi-error border border-moncchichi-error/30 font-bold text-xs flex items-center justify-center gap-2 hover:bg-moncchichi-error/20 transition-colors"><Trash2 size={14} /> Replace Existing</button>
                        <div className="grid grid-cols-2 gap-2"><button onClick={() => resolveConflict('KEEP_BOTH')} className="py-3 rounded-xl bg-moncchichi-surfaceAlt text-moncchichi-text border border-moncchichi-border font-bold text-xs flex items-center justify-center gap-2 hover:bg-moncchichi-border transition-colors"><Copy size={14} /> Keep Both</button><button onClick={() => resolveConflict('SKIP')} className="py-3 rounded-xl bg-moncchichi-surfaceAlt text-moncchichi-textSec border border-moncchichi-border font-bold text-xs flex items-center justify-center gap-2 hover:bg-moncchichi-border transition-colors"><X size={14} /> Cancel Upload</button></div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4 animate-in fade-in pb-20">
            {renderConflictModal()}
            <div className="flex items-center justify-between px-1 mb-2">
                <h3 className="text-xs font-bold text-moncchichi-textSec uppercase tracking-wider">Your Scrolls</h3>
                <button onClick={() => setIsAddingCategory(true)} className="flex items-center gap-1 text-[10px] font-bold bg-moncchichi-surfaceAlt px-2 py-1 rounded text-moncchichi-accent border border-moncchichi-border hover:bg-moncchichi-surface transition-colors"><FolderPlus size={12} /> New Folder</button>
            </div>

            {/* Add Category Input */}
            {isAddingCategory && (
                <div className="flex items-center gap-2 p-3 bg-moncchichi-surface rounded-xl border border-moncchichi-border border-dashed animate-in fade-in slide-in-from-top-1">
                    <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Category Name..." className="flex-1 bg-moncchichi-bg border border-moncchichi-accent rounded px-3 py-1.5 text-xs focus:outline-none" autoFocus onKeyDown={e => e.key === 'Enter' && onAddCategory()} />
                    <button onClick={onAddCategory} className="bg-moncchichi-success/10 text-moncchichi-success p-1.5 rounded hover:bg-moncchichi-success/20"><CheckCircle size={16} /></button>
                    <button onClick={() => setIsAddingCategory(false)} className="bg-moncchichi-error/10 text-moncchichi-error p-1.5 rounded hover:bg-moncchichi-error/20"><X size={16} /></button>
                </div>
            )}

            {files.length === 0 && (
                <div className="p-8 border-2 border-dashed border-moncchichi-border rounded-xl flex flex-col items-center justify-center text-center gap-3 opacity-60 hover:opacity-100 transition-opacity bg-moncchichi-surfaceAlt/30" onClick={() => onUploadToCategory('Unlisted')}>
                    <Upload size={24} className="text-moncchichi-textSec" />
                    <div className="text-xs font-bold text-moncchichi-textSec">Upload PDF to Codex</div>
                </div>
            )}

            {/* Categories Loop */}
            {displayCategories.map(category => {
                const items = groupedFiles[category] || [];
                const isCustom = !['Unlisted'].includes(category);
                if (items.length === 0 && !isCustom && category === 'Unlisted') return null;

                const isEmpty = items.length === 0;
                // Default to collapsed if empty, unless explicitly set in state
                const isCollapsed = collapsedCategories[category] ?? isEmpty;

                return (
                    <div key={category} className="bg-moncchichi-surface/20 rounded-xl border border-moncchichi-border/30 overflow-hidden">
                        <div 
                            className="flex items-center gap-2 p-3 cursor-pointer hover:bg-moncchichi-surfaceAlt/50 transition-colors" 
                            onClick={() => setCollapsedCategories(prev => ({ ...prev, [category]: !(prev[category] ?? isEmpty) }))}
                        >
                            {editingCategory === category ? (
                                <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                                    <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="bg-moncchichi-bg border border-moncchichi-accent rounded px-2 py-1 text-sm flex-1 focus:outline-none" autoFocus />
                                    <button onClick={() => onRenameCategory(category)} className="p-1 text-moncchichi-success"><CheckCircle size={14}/></button>
                                </div>
                            ) : (
                                <>
                                    <span className="text-sm font-bold text-moncchichi-text">{category}</span>
                                    <span className="text-[10px] bg-moncchichi-surfaceAlt px-2 rounded-full text-moncchichi-textSec">{items.length}</span>
                                </>
                            )}
                            <div className="ml-auto flex items-center gap-2">
                                {/* Upload Button */}
                                <button 
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        onUploadToCategory(category);
                                    }} 
                                    className="text-moncchichi-textSec hover:text-moncchichi-accent p-1"
                                    title="Upload to this folder"
                                >
                                    <Upload size={14} />
                                </button>

                                {isCustom && !editingCategory && (
                                    <>
                                        <button onClick={(e) => { e.stopPropagation(); onMoveCategoryUp(category); }} className="text-moncchichi-textSec hover:text-moncchichi-text p-1"><ArrowUp size={12} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); onMoveCategoryDown(category); }} className="text-moncchichi-textSec hover:text-moncchichi-text p-1"><ArrowDown size={12} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); setEditingCategory(category); setRenameValue(category); }} className="text-moncchichi-textSec hover:text-moncchichi-accent p-1"><Edit2 size={12} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); onDeleteCategory(category); }} className="text-moncchichi-textSec hover:text-moncchichi-error p-1"><Trash2 size={12} /></button>
                                    </>
                                )}
                                <div className="text-moncchichi-textSec">{isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</div>
                            </div>
                        </div>

                        {!isCollapsed && items.length > 0 && (
                            <div className="space-y-2 p-2 pt-0 animate-in slide-in-from-top-1">
                                {items.map(file => {
                                    const isEnriching = enrichingBookIds.has(file.id);
                                    
                                    return (
                                    <div key={file.id} onClick={() => onFileClick(file)} className="flex items-center gap-3 p-3 bg-moncchichi-surface border border-moncchichi-border rounded-xl cursor-pointer hover:bg-moncchichi-surfaceAlt transition-all group active:scale-[0.99] relative">
                                        <div className={`p-3 bg-moncchichi-surfaceAlt rounded-lg transition-colors border border-moncchichi-border/30 relative overflow-hidden text-moncchichi-textSec group-hover:text-moncchichi-text`}>
                                            {file.coverUrl ? (
                                                <img src={file.coverUrl} className="absolute inset-0 w-full h-full object-cover" />
                                            ) : (
                                                <FileText size={20} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-sm text-moncchichi-text truncate">{formatDisplayTitle(file.title)}</div>
                                            <div className="text-[10px] text-moncchichi-textSec truncate">{file.author}</div>
                                        </div>
                                        
                                        {/* Actions Row */}
                                        <div className="flex items-center gap-1">
                                            {/* AI Enrichment Button */}
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onEnrichFile(file); }}
                                                className={`p-2 rounded-full transition-colors ${isEnriching ? 'bg-moncchichi-accent text-moncchichi-bg animate-pulse' : 'text-moncchichi-textSec hover:text-moncchichi-accent hover:bg-moncchichi-surfaceAlt'}`}
                                                disabled={isEnriching}
                                            >
                                                {isEnriching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                            </button>

                                            {/* Move Button */}
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setActiveMoveMenu(activeMoveMenu === file.id ? null : file.id); }}
                                                className={`p-2 rounded-full transition-colors ${activeMoveMenu === file.id ? 'text-moncchichi-text bg-moncchichi-surfaceAlt' : 'text-moncchichi-textSec hover:text-moncchichi-text hover:bg-moncchichi-surfaceAlt'}`}
                                            >
                                                <Move size={14} />
                                            </button>

                                            {/* Delete Button (Only visible on hover/active in group) */}
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onDeleteBook(file.id); }}
                                                className="p-2 text-moncchichi-textSec hover:text-moncchichi-error opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>

                                        {/* Move Menu Dropdown */}
                                        {activeMoveMenu === file.id && (
                                            <div className="absolute right-10 top-8 z-20 bg-moncchichi-surfaceAlt border border-moncchichi-border rounded-lg shadow-xl py-1 w-32 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                                                {['Unlisted', ...categories].filter(c => c !== file.category).map(cat => (
                                                    <button 
                                                        key={cat} 
                                                        onClick={() => onMoveBook(file.id, cat)}
                                                        className="w-full text-left px-3 py-2 text-[10px] font-bold text-moncchichi-text hover:bg-moncchichi-surface truncate"
                                                    >
                                                        Move to {cat}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                                })}
                            </div>
                        )}
                        {!isCollapsed && items.length === 0 && (
                            <div className="p-4 text-center text-[10px] text-moncchichi-textSec italic opacity-50">Empty Folder</div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default CodexLibrary;
