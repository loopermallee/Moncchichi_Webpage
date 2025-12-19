
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { bookService, Book } from '../services/bookService';
import { protocolService, ProtocolMatch } from '../services/protocolService';
import { X, BookOpen, Play } from 'lucide-react';

import CodexHeader from '../components/codex/CodexHeader';
import CodexSearchBar from '../components/codex/CodexSearchBar';
import CodexSearchStatus, { ScanProgressItem } from '../components/codex/CodexSearchStatus';
import CodexLibrary, { DuplicateConflict } from '../components/codex/CodexLibrary';
import CodexSearchResults from '../components/codex/CodexSearchResults';
import CodexViewer from '../components/codex/CodexViewer';

// Internal component for book summary since it uses logic specific to this view's actions
const SummaryOverlay = ({ book, onClose, onOpen }: { book: Book, onClose: () => void, onOpen: () => void }) => {
    return (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-moncchichi-surface border border-moncchichi-border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="relative h-48 bg-moncchichi-surfaceAlt shrink-0">
                    {book.coverUrl ? (
                        <>
                            <img src={book.coverUrl} className="w-full h-full object-cover opacity-50 blur-sm" />
                            <div className="absolute inset-0 bg-gradient-to-t from-moncchichi-surface via-transparent to-transparent" />
                            <img src={book.coverUrl} className="absolute bottom-4 left-4 w-24 h-36 object-cover rounded-lg shadow-lg border border-moncchichi-border/50" />
                        </>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-moncchichi-textSec">
                            <BookOpen size={48} className="opacity-20" />
                        </div>
                    )}
                    <button onClick={onClose} className="absolute top-2 right-2 p-2 bg-black/40 rounded-full text-white hover:bg-black/60 transition-colors">
                        <X size={18} />
                    </button>
                </div>
                
                <div className="p-6 flex-1 overflow-y-auto">
                    <h2 className="text-xl font-bold text-moncchichi-text mb-1 leading-tight">{book.title}</h2>
                    <p className="text-sm text-moncchichi-textSec mb-4">{book.author}</p>
                    
                    <div className="flex gap-2 mb-4">
                        {book.tags?.map(tag => (
                            <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-moncchichi-surfaceAlt border border-moncchichi-border text-moncchichi-textSec font-bold uppercase">
                                {tag}
                            </span>
                        ))}
                    </div>

                    <div className="prose prose-invert prose-xs text-xs leading-relaxed text-moncchichi-text opacity-90">
                        {book.description || "No synopsis available."}
                    </div>
                </div>

                <div className="p-4 border-t border-moncchichi-border bg-moncchichi-surface shrink-0">
                    <button 
                        onClick={onOpen}
                        className="w-full py-3 bg-moncchichi-accent text-moncchichi-bg rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-lg shadow-moncchichi-accent/20 active:scale-95"
                    >
                        <BookOpen size={18} /> Open Document
                    </button>
                </div>
            </div>
        </div>
    );
};

const Protocol: React.FC<{ onBack: () => void, onShowToast: (msg: string, type: any) => void }> = ({ onBack, onShowToast }) => {
    // --- Data State ---
    const [files, setFiles] = useState<Book[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    
    // --- Search State ---
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [scanProgress, setScanProgress] = useState<ScanProgressItem[]>([]);
    const [matches, setMatches] = useState<ProtocolMatch[]>([]);
    
    // --- UI State ---
    const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategory, setEditingCategory] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [activeMoveMenu, setActiveMoveMenu] = useState<string | null>(null);
    const [activeBookSummary, setActiveBookSummary] = useState<Book | null>(null);
    const [enrichingBookIds, setEnrichingBookIds] = useState<Set<string>>(new Set());
    
    // --- Viewer State ---
    const [activeMatchIndex, setActiveMatchIndex] = useState<number | null>(null);

    // --- Upload State ---
    const [conflictQueue, setConflictQueue] = useState<DuplicateConflict[]>([]);
    const [pendingUploadCategory, setPendingUploadCategory] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const activeQueryRef = useRef(searchQuery);

    // --- Effects ---

    useEffect(() => {
        const load = () => {
            // PDF ONLY: Filter out AUDIO types
            const lib = bookService.getLibrary().filter(b => b.type === 'PDF');
            setFiles(lib);
            setCategories(bookService.getCategories()); 
        };
        load();
        const unsub = bookService.subscribe(load);
        return unsub;
    }, []);

    const groupedFiles = useMemo(() => {
        // Shared display categories logic will be handled inside Library or passed down
        // Replicating logic here for correct prop passing
        const groups: Record<string, Book[]> = {};
        const allCats = [...categories];
        if (!allCats.includes('Unlisted')) allCats.push('Unlisted');
        
        allCats.forEach(c => groups[c] = []);
        
        files.forEach(f => {
            const cat = f.category && groups[f.category] ? f.category : 'Unlisted';
            if (groups[cat]) {
                groups[cat].push(f);
            } else {
                if (!groups['Unlisted']) groups['Unlisted'] = [];
                groups['Unlisted'].push(f);
            }
        });
        return groups;
    }, [files, categories]);

    // Instant Search
    useEffect(() => {
        activeQueryRef.current = searchQuery;
        const delayDebounceFn = setTimeout(() => {
            if (searchQuery.trim().length > 0) {
                handleSearch();
            } else {
                setMatches([]);
                setIsSearching(false);
                setScanProgress([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    // --- Handlers ---

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        setMatches([]); 
        setScanProgress([]);
        try {
            await protocolService.searchAllLibraryStream(searchQuery, (event) => {
                if (activeQueryRef.current !== searchQuery) return;
                
                if (event.type === 'START_FILE') { 
                    setScanProgress(prev => [...prev, { name: event.fileName, status: 'scanning' }]);
                } 
                else if (event.type === 'MATCHES') { 
                    setMatches(prev => [...prev, ...event.matches]); 
                } 
                else if (event.type === 'FILE_COMPLETE') {
                    setScanProgress(prev => prev.map(p => {
                        if (p.name === event.fileName) {
                            return { ...p, status: event.matchCount > 0 ? 'found' : 'empty' };
                        }
                        return p;
                    }));
                    setTimeout(() => {
                        setScanProgress(prev => prev.filter(p => p.name !== event.fileName));
                    }, 2000);
                }
                else if (event.type === 'COMPLETE') { 
                    setIsSearching(false); 
                }
            });
        } catch (e) { console.error(e); setIsSearching(false); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList || fileList.length === 0) {
            setPendingUploadCategory(null);
            return;
        }
        const incomingFiles = Array.from(fileList) as File[];
        let successCount = 0;
        const conflicts: DuplicateConflict[] = [];
        const currentLibrary = bookService.getLibrary().filter(b => b.type === 'PDF');

        for (const file of incomingFiles) {
            const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
            if (!isPdf) { onShowToast(`Skipped ${file.name}: Only PDF supported.`, "error"); continue; }
            
            const cleanTitle = file.name.replace(/\.pdf$/i, '');
            const existing = currentLibrary.find(b => b.title.toLowerCase() === cleanTitle.toLowerCase());
            
            if (existing) { 
                conflicts.push({ 
                    file, 
                    existingBook: existing, 
                    targetCategory: pendingUploadCategory || 'Unlisted' 
                }); 
            } 
            else {
                onShowToast(`Inscribing ${file.name}...`, "info");
                try { 
                    await bookService.addLocalPdf(file, undefined, pendingUploadCategory || 'Unlisted'); 
                    successCount++; 
                } catch (err) { onShowToast(`Failed to add ${file.name}`, "error"); }
            }
        }
        if (conflicts.length > 0) setConflictQueue(conflicts);
        if (successCount > 0) onShowToast(`${successCount} Item${successCount > 1 ? 's' : ''} Added to ${pendingUploadCategory || 'Codex'}`, "success");
        if (fileInputRef.current) fileInputRef.current.value = '';
        setPendingUploadCategory(null);
    };

    const resolveConflict = async (decision: 'REPLACE' | 'KEEP_BOTH' | 'SKIP') => {
        const currentConflict = conflictQueue[0];
        if (!currentConflict) return;
        const { file, existingBook, targetCategory } = currentConflict;
        
        try {
            if (decision === 'REPLACE') { 
                await bookService.deleteBook(existingBook.id); 
                await bookService.addLocalPdf(file, undefined, targetCategory || 'Unlisted'); 
                onShowToast(`Replaced ${file.name}`, "success"); 
            } 
            else if (decision === 'KEEP_BOTH') { 
                const newTitle = `${file.name.replace(/\.pdf$/i, '')} (Copy)`; 
                await bookService.addLocalPdf(file, newTitle, targetCategory || 'Unlisted'); 
                onShowToast(`Added ${newTitle}`, "success"); 
            } 
            else { onShowToast(`Skipped ${file.name}`, "info"); }
        } catch (e) { onShowToast(`Error processing ${file.name}`, "error"); }
        setConflictQueue(prev => prev.slice(1));
    };

    const handleEnrichFile = async (book: Book) => {
        setEnrichingBookIds(prev => { const next = new Set(prev); next.add(book.id); return next; });
        onShowToast("Consulting the Oracle...", "info");
        try {
            await bookService.identifyLocalFile(book);
            onShowToast(`Updated: ${book.title}`, "success");
        } catch (e) {
            onShowToast("Identification failed", "error");
        } finally {
            setEnrichingBookIds(prev => { const next = new Set(prev); next.delete(book.id); return next; });
        }
    };

    // Viewer / Navigation Handlers
    const openFile = (book: Book) => {
        setActiveBookSummary(null);
        setMatches([{
            bookId: book.id,
            bookTitle: book.title,
            pageIndex: 1,
            context: "Full Document View"
        }]);
        setActiveMatchIndex(0);
    };

    const openMatch = (index: number) => {
        setActiveMatchIndex(index);
    };

    const closeViewer = () => {
        setActiveMatchIndex(null);
        if (matches.length === 1 && matches[0].context === "Full Document View") {
            setMatches([]);
        }
    };

    const handleUploadToCategory = (cat: string) => {
        setPendingUploadCategory(cat);
        fileInputRef.current?.click();
    };

    // Category Handlers
    const handleAddCategory = () => {
        if (newCategoryName.trim()) {
            bookService.addCategory(newCategoryName);
            setNewCategoryName('');
            setIsAddingCategory(false);
        }
    };

    const handleRenameCategory = (oldName: string) => {
        if (renameValue.trim() && renameValue !== oldName) {
            bookService.renameCategory(oldName, renameValue);
        }
        setEditingCategory(null);
    };

    const handleMoveBook = (bookId: string, category: string) => {
        bookService.updateBookCategory(bookId, category);
        setActiveMoveMenu(null);
        onShowToast(`Moved to ${category}`, 'info');
    };

    return (
        <div className="flex flex-col h-full bg-moncchichi-bg">
            <CodexViewer 
                isOpen={activeMatchIndex !== null}
                matches={matches}
                activeMatchIndex={activeMatchIndex}
                searchQuery={searchQuery}
                onClose={closeViewer}
                onChangeMatch={setActiveMatchIndex}
            />
            
            {activeBookSummary && (
                <SummaryOverlay 
                    book={activeBookSummary} 
                    onClose={() => setActiveBookSummary(null)} 
                    onOpen={() => openFile(activeBookSummary)} 
                />
            )}

            <CodexHeader 
                onBack={onBack} 
                onUploadClick={() => { setPendingUploadCategory(null); fileInputRef.current?.click(); }} 
            />
            
            <input 
                type="file" 
                accept="application/pdf" 
                multiple 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
            />

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <CodexSearchBar 
                    value={searchQuery} 
                    onChange={setSearchQuery} 
                    isSearching={isSearching} 
                />

                <CodexSearchStatus 
                    isSearching={isSearching} 
                    scanProgress={scanProgress} 
                />

                {/* Conditional Rendering: Search Results vs Library */}
                {matches.length > 0 || (searchQuery && !isSearching) ? (
                    <CodexSearchResults 
                        matches={matches} 
                        isSearching={isSearching} 
                        searchQuery={searchQuery}
                        onMatchClick={openMatch}
                    />
                ) : (
                    <CodexLibrary 
                        files={files}
                        categories={categories}
                        groupedFiles={groupedFiles}
                        collapsedCategories={collapsedCategories}
                        setCollapsedCategories={setCollapsedCategories}
                        
                        onFileClick={(book) => setActiveBookSummary(book)}
                        onEnrichFile={handleEnrichFile}
                        onMoveBook={handleMoveBook}
                        onDeleteBook={(id) => bookService.deleteBook(id)}
                        
                        isAddingCategory={isAddingCategory}
                        setIsAddingCategory={setIsAddingCategory}
                        newCategoryName={newCategoryName}
                        setNewCategoryName={setNewCategoryName}
                        onAddCategory={handleAddCategory}
                        
                        editingCategory={editingCategory}
                        setEditingCategory={setEditingCategory}
                        renameValue={renameValue}
                        setRenameValue={setRenameValue}
                        onRenameCategory={handleRenameCategory}
                        onDeleteCategory={(name) => bookService.deleteCategory(name)}
                        onMoveCategoryUp={(name) => bookService.moveCategoryUp(name)}
                        onMoveCategoryDown={(name) => bookService.moveCategoryDown(name)}
                        
                        onUploadToCategory={handleUploadToCategory}
                        
                        activeMoveMenu={activeMoveMenu}
                        setActiveMoveMenu={setActiveMoveMenu}
                        enrichingBookIds={enrichingBookIds}
                        
                        conflictQueue={conflictQueue}
                        resolveConflict={resolveConflict}
                    />
                )}
            </div>
        </div>
    );
};

export default Protocol;
