
import React, { useState, useEffect, useRef } from 'react';
import { ProtocolMatch, protocolService } from '../../services/protocolService';
import { bookService } from '../../services/bookService';
import PdfPage from './PdfPage';
import { X, ChevronUp, ChevronDown, Settings, MoveHorizontal, MoveVertical, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';

interface CodexViewerProps {
    isOpen: boolean;
    matches: ProtocolMatch[];
    activeMatchIndex: number | null;
    searchQuery: string;
    onClose: () => void;
    onChangeMatch: (index: number) => void;
}

type ReadingDirection = 'HORIZONTAL' | 'VERTICAL';

const CodexViewer: React.FC<CodexViewerProps> = ({ 
    isOpen, matches, activeMatchIndex, searchQuery, onClose, onChangeMatch 
}) => {
    if (!isOpen || activeMatchIndex === null) return null;

    const activeMatch = matches[activeMatchIndex];
    if (!activeMatch) return null;

    // Local State for PDF handling
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [totalPages, setTotalPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pdfPagesRendered, setPdfPagesRendered] = useState<number[]>([]);
    
    // UI State
    const [readingMode, setReadingMode] = useState<ReadingDirection>('HORIZONTAL');
    const [zoomLevel, setZoomLevel] = useState(1.0);
    const [showSettings, setShowSettings] = useState(false);
    const [initialLoading, setInitialLoading] = useState(false);
    const [containerWidth, setContainerWidth] = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const currentDocIdRef = useRef<string | null>(null);
    const pinchRef = useRef<{ startDist: number, startZoom: number } | null>(null);

    // Measure container for PDF scaling
    useEffect(() => {
        if (containerRef.current) {
            setContainerWidth(containerRef.current.clientWidth);
        }
        const handleResize = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.clientWidth);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isOpen]);

    // Load PDF when match changes
    useEffect(() => {
        const loadContent = async () => {
            const isNewDoc = currentDocIdRef.current !== activeMatch.bookId;
            const book = bookService.getBookById(activeMatch.bookId);

            if (isNewDoc) {
                setInitialLoading(true);
                setPdfDoc(null);
                setZoomLevel(1.0);
            }

            if (isNewDoc) {
                if (!book || !book.pdfAssetId) {
                    setInitialLoading(false);
                    return;
                }
                try {
                    const blob = await bookService.getPdfBlob(book.pdfAssetId);
                    if (blob) {
                        const doc = await protocolService.loadPdfDocument(blob);
                        setPdfDoc(doc);
                        setTotalPages(doc.numPages);
                        currentDocIdRef.current = activeMatch.bookId;
                    }
                } catch (e) { console.error("PDF Load Failed", e); }
                setInitialLoading(false);
            }

            // Sync page view
            if (readingMode === 'HORIZONTAL') {
                setPdfPagesRendered([activeMatch.pageIndex]);
                setCurrentPage(activeMatch.pageIndex);
            } else {
                // In vertical mode, ideally render all or windowed. For now render all as per original logic.
                // Note: original logic rendered ALL pages in vertical.
                // We'll update this once doc is loaded.
                if (pdfDoc) {
                    setPdfPagesRendered(Array.from({length: pdfDoc.numPages}, (_, i) => i + 1));
                }
            }
            
            if (containerRef.current) {
                containerRef.current.scrollTop = 0;
            }
        };

        loadContent();
    }, [activeMatch, readingMode]); // Rerun if match changes or mode switches

    // Sync rendered pages when doc loads in Vertical mode
    useEffect(() => {
        if (readingMode === 'VERTICAL' && pdfDoc) {
            setPdfPagesRendered(Array.from({length: pdfDoc.numPages}, (_, i) => i + 1));
        }
    }, [pdfDoc, readingMode]);

    const handlePageTurn = (dir: number) => {
        const next = Math.min(Math.max(1, currentPage + dir), totalPages);
        setCurrentPage(next);
        setPdfPagesRendered([next]);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const dist = Math.hypot(touch1.pageX - touch2.pageX, touch1.pageY - touch2.pageY);
            pinchRef.current = { startDist: dist, startZoom: zoomLevel };
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && pinchRef.current) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const dist = Math.hypot(touch1.pageX - touch2.pageX, touch1.pageY - touch2.pageY);
            const scaleFactor = dist / pinchRef.current.startDist;
            const newZoom = Math.min(Math.max(pinchRef.current.startZoom * scaleFactor, 1.0), 3.0);
            setZoomLevel(newZoom);
            e.preventDefault(); 
        }
    };

    const isSingleDoc = matches.length === 1 && matches[0].context === "Full Document View";

    return (
        <div className="fixed inset-0 z-[200] bg-moncchichi-bg flex flex-col animate-in fade-in duration-200">
            <div className="px-4 py-3 border-b border-moncchichi-border bg-moncchichi-surface flex items-center justify-between shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button onClick={onClose} className="p-2 -ml-2 text-moncchichi-textSec hover:text-moncchichi-text rounded-full hover:bg-moncchichi-surfaceAlt transition-colors">
                        <X size={20} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm text-moncchichi-text truncate">{activeMatch.bookTitle}</h3>
                        <div className="text-[10px] text-moncchichi-textSec flex items-center gap-2">
                            <span>Page {isSingleDoc ? currentPage : activeMatch.pageIndex}</span>
                            {matches.length > 1 && !isSingleDoc && (
                                <span className="bg-moncchichi-surfaceAlt px-1.5 rounded border border-moncchichi-border/50">Match {activeMatchIndex + 1} of {matches.length}</span>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-1 relative">
                    <button 
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-moncchichi-accent text-moncchichi-bg' : 'text-moncchichi-textSec hover:text-moncchichi-text'}`}
                    >
                        <Settings size={20} />
                    </button>
                    
                    {showSettings && (
                        <div className="absolute top-10 right-0 w-48 bg-moncchichi-surfaceAlt border border-moncchichi-border rounded-xl shadow-xl p-2 z-30 animate-in fade-in zoom-in-95">
                            <div className="text-[10px] font-bold text-moncchichi-textSec px-2 py-1 uppercase">Reading Mode</div>
                            <button 
                                onClick={() => { setReadingMode('HORIZONTAL'); setShowSettings(false); }}
                                className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-bold ${readingMode === 'HORIZONTAL' ? 'bg-moncchichi-accent text-moncchichi-bg' : 'text-moncchichi-text hover:bg-moncchichi-surface'}`}
                            >
                                <MoveHorizontal size={14} /> Paged (Horizontal)
                            </button>
                            <button 
                                onClick={() => { setReadingMode('VERTICAL'); setShowSettings(false); }}
                                className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-bold ${readingMode === 'VERTICAL' ? 'bg-moncchichi-accent text-moncchichi-bg' : 'text-moncchichi-text hover:bg-moncchichi-surface'}`}
                            >
                                <MoveVertical size={14} /> Scroll (Vertical)
                            </button>
                        </div>
                    )}

                    {!isSingleDoc && (
                        <>
                            <button onClick={() => onChangeMatch(activeMatchIndex - 1)} disabled={activeMatchIndex === 0} className="p-2 text-moncchichi-textSec hover:text-moncchichi-text disabled:opacity-30"><ChevronUp size={20} /></button>
                            <button onClick={() => onChangeMatch(activeMatchIndex + 1)} disabled={activeMatchIndex === matches.length - 1} className="p-2 text-moncchichi-textSec hover:text-moncchichi-text disabled:opacity-30"><ChevronDown size={20} /></button>
                        </>
                    )}
                </div>
            </div>

            <div 
                className="flex-1 overflow-y-auto bg-moncchichi-surfaceAlt/30 relative" 
                ref={containerRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={() => { pinchRef.current = null; }}
            >
                {initialLoading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-moncchichi-textSec">
                        <Loader2 size={32} className="animate-spin text-moncchichi-accent" />
                        <span className="text-xs font-bold animate-pulse">Loading Document...</span>
                    </div>
                ) : (
                    <div className={`min-h-full p-4 flex justify-center origin-top transition-transform duration-100 ease-out ${readingMode === 'VERTICAL' ? 'flex-col items-center gap-4' : ''}`} style={{ transform: `scale(${zoomLevel})` }}>
                        {pdfDoc && pdfPagesRendered.map(pageNum => (
                            <PdfPage 
                                key={pageNum} 
                                pdfDoc={pdfDoc} 
                                pageNum={pageNum} 
                                width={containerWidth > 0 ? containerWidth : window.innerWidth} 
                                searchQuery={searchQuery}
                            />
                        ))}
                    </div>
                )}
            </div>
            
            {/* Horizontal Page Navigation Bar */}
            {readingMode === 'HORIZONTAL' && (
                <div className="px-4 py-3 bg-moncchichi-surface border-t border-moncchichi-border flex justify-between items-center z-10 shrink-0">
                    <button onClick={() => handlePageTurn(-1)} disabled={currentPage <= 1} className="p-2 text-moncchichi-textSec hover:text-moncchichi-text disabled:opacity-30 bg-moncchichi-surfaceAlt rounded-full"><ArrowLeft size={18}/></button>
                    <span className="text-xs font-mono font-bold text-moncchichi-text">{currentPage} / {totalPages}</span>
                    <button onClick={() => handlePageTurn(1)} disabled={currentPage >= totalPages} className="p-2 text-moncchichi-textSec hover:text-moncchichi-text disabled:opacity-30 bg-moncchichi-surfaceAlt rounded-full"><ArrowRight size={18}/></button>
                </div>
            )}
        </div>
    );
};

export default CodexViewer;
