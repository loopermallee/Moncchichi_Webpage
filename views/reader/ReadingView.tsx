
import React, { useState, useEffect, useRef } from 'react';
import { Book } from '../../services/bookService';
import AudioPlayer from '../../components/reader/AudioPlayer';
import PdfPage from '../../components/reader/PdfViewer';
import { TransitionOverlay, ChapterAnnouncement, EndOfSeriesOverlay } from '../../components/reader/ReaderShared';
import { ChevronLeft, Bookmark, Glasses, Loader2, Link2, Settings, MoveHorizontal, MoveVertical, ArrowLeft, ArrowRight, X, ExternalLink } from 'lucide-react';

type ReadingDirection = 'HORIZONTAL' | 'VERTICAL';

interface ReadingViewProps {
    activeBook: Book;
    pages: string[]; 
    pdfDoc: any;     
    pdfBlobUrl: string | null;
    loadedChapters: { id: string, title: string, pages: string[] }[]; 
    loadingNextChapter: boolean;
    showEndOfSeries: boolean;
    onBack: () => void;
    onBookmark: (e: React.MouseEvent) => void;
    onSendToGlasses: () => void;
    onNextChapter: () => void;
    onPrevChapter: () => void; 
    onPageChange: (delta: number) => void;
    currentPage: number;
    totalPages: number;
    transitioningChapter: string | null;
    chapterAnnouncement: string | null;
    showControls: boolean;
    setShowControls: (show: boolean) => void;
    isLoadingContent: boolean;
    webViewUrl: string | null;
    readingMode: ReadingDirection;
    setReadingMode: (mode: ReadingDirection) => void;
    settingsFocus: boolean;
    setSettingsFocus: (focus: boolean) => void;
    showSettings: boolean;
    setShowSettings: (show: boolean) => void;
    bottomSentinelRef: React.RefObject<HTMLDivElement>;
    containerRef: React.RefObject<HTMLDivElement>;
    pdfPagesRendered: number[];
    showCastButton?: boolean; // New Prop
}

const ReadingView: React.FC<ReadingViewProps> = (props) => {
    const {
        activeBook, pages, pdfDoc, pdfBlobUrl, loadedChapters, loadingNextChapter, showEndOfSeries,
        onBack, onBookmark, onSendToGlasses, onNextChapter, onPrevChapter, onPageChange,
        currentPage, totalPages, transitioningChapter, chapterAnnouncement,
        showControls, setShowControls, isLoadingContent, webViewUrl,
        readingMode, setReadingMode, settingsFocus, setSettingsFocus, showSettings, setShowSettings,
        bottomSentinelRef, containerRef, pdfPagesRendered, showCastButton = true
    } = props;

    const [containerWidth, setContainerWidth] = useState(0);

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
    }, [containerRef.current]);

    const handleSettingsToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowSettings(!showSettings);
        setSettingsFocus(true);
    };

    const handleOpenOriginal = () => {
        if (activeBook.downloadUrl) {
            window.open(activeBook.downloadUrl, '_blank');
        }
    };

    return (
       <div className="flex flex-col h-full bg-black relative">
       
       {transitioningChapter && <TransitionOverlay title={transitioningChapter} />}
       
       {chapterAnnouncement && <ChapterAnnouncement title={chapterAnnouncement} />}

       {showEndOfSeries && (
           <EndOfSeriesOverlay 
                onBack={onBack} 
                onReplay={() => {
                    onBack();
                }}
           />
       )}
       
       {/* Controls Overlay */}
       <div className={`absolute top-0 w-full p-4 flex justify-between items-center z-20 transition-opacity bg-gradient-to-b from-black/80 to-transparent ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
           <button onClick={onBack} className="p-2 bg-black/40 backdrop-blur rounded-full text-white"><ChevronLeft/></button>
           <div className="text-white text-xs font-bold opacity-80 truncate px-4">{activeBook.title}</div>
           <div className="flex items-center gap-2">
                {(!activeBook.type.includes('AUDIO') && !activeBook.type.includes('WEB')) && (
                    <button onClick={onBookmark} className="p-2 bg-black/40 backdrop-blur rounded-full text-white hover:bg-white/20 transition-colors">
                        <Bookmark size={18} />
                    </button>
                )}
                {showCastButton && (
                    <button onClick={onSendToGlasses} disabled={activeBook.type === 'PDF' || activeBook.type === 'WEB' || activeBook.type === 'AUDIO'} className="p-2 bg-moncchichi-accent text-moncchichi-bg rounded-full font-bold flex gap-2 px-4 disabled:opacity-50 disabled:grayscale"><Glasses size={18}/> Cast</button>
                )}
           </div>
       </div>
       
       {/* Content Viewer */}
       <div className="flex-1 overflow-hidden relative flex items-center justify-center bg-[#1a1a1a]" onClick={() => setShowControls(!showControls)}>
           {isLoadingContent ? (
               <div className="flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-moncchichi-accent" size={32}/>
                    <span className="text-xs text-moncchichi-textSec">Loading Content...</span>
               </div>
           ) : activeBook.type === 'AUDIO' ? (
               <AudioPlayer book={activeBook} />
           ) : webViewUrl ? (
               <iframe 
                 src={webViewUrl} 
                 className="w-full h-full border-0 bg-white"
                 title="Web Reader"
                 sandbox="allow-scripts allow-same-origin allow-popups"
               />
           ) : pdfBlobUrl ? (
               <object 
                   data={pdfBlobUrl} 
                   type="application/pdf" 
                   className="w-full h-full"
               >
                   <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
                       <p className="text-white text-sm">Unable to render PDF directly in this view.</p>
                       <div className="flex gap-3">
                           <a href={pdfBlobUrl} download="document.pdf" className="px-4 py-2 bg-moncchichi-surfaceAlt rounded-lg text-xs font-bold text-white border border-moncchichi-border">Download</a>
                           {activeBook.downloadUrl && (
                               <button onClick={handleOpenOriginal} className="px-4 py-2 bg-moncchichi-accent text-moncchichi-bg rounded-lg text-xs font-bold flex items-center gap-2">
                                   <ExternalLink size={14} /> Open Source
                               </button>
                           )}
                       </div>
                   </div>
               </object>
           ) : activeBook.type === 'PDF' && pdfDoc ? (
                <div 
                    className="w-full h-full overflow-y-auto bg-[#1a1a1a] relative"
                    ref={containerRef}
                >
                    <div className="flex flex-col items-center py-4 gap-4 min-h-full">
                        {pdfPagesRendered.map(pageNum => (
                            <PdfPage 
                                key={pageNum} 
                                pdfDoc={pdfDoc} 
                                pageNum={pageNum} 
                                width={containerWidth || window.innerWidth} 
                            />
                        ))}
                    </div>
                </div>
           ) : activeBook.type === 'PDF' && !pdfDoc ? (
                // PDF Fallback when local blob fails but we have a URL
                <div className="flex flex-col items-center justify-center p-8 text-center max-w-sm">
                    <div className="p-4 bg-moncchichi-surfaceAlt rounded-full mb-4 border border-moncchichi-border">
                        <Link2 size={32} className="text-moncchichi-textSec" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">External PDF</h3>
                    <p className="text-sm text-moncchichi-textSec mb-6">
                        This document cannot be embedded due to source restrictions (CORS).
                    </p>
                    {activeBook.downloadUrl && (
                        <button 
                            onClick={handleOpenOriginal}
                            className="w-full py-3 bg-moncchichi-accent text-moncchichi-bg rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                        >
                            <ExternalLink size={18} /> Open in Browser
                        </button>
                    )}
                </div>
           ) : activeBook.type === 'MANGA' ? (
               // ... Manga logic remains same ...
               loadedChapters.length > 0 ? (
                   <div className="w-full h-full overflow-y-auto bg-[#1a1a1a] no-scrollbar">
                       {loadedChapters.map((chap, cIdx) => (
                           <div key={chap.id} className="flex flex-col">
                               {cIdx > 0 && (
                                   <div className="py-4 text-center text-moncchichi-textSec text-xs font-bold border-t border-b border-moncchichi-border bg-moncchichi-surfaceAlt/20">
                                       {chap.title}
                                   </div>
                               )}
                               {chap.pages.map((src, pIdx) => (
                                   <img key={`${chap.id}-${pIdx}`} src={src} className="w-full max-w-2xl mx-auto" loading="lazy" referrerPolicy="no-referrer" />
                               ))}
                           </div>
                       ))}
                       <div ref={bottomSentinelRef} className="h-20 w-full flex items-center justify-center p-4">
                           {loadingNextChapter && <Loader2 className="animate-spin text-moncchichi-accent" />}
                           {!loadingNextChapter && loadedChapters.length > 0 && <span className="text-xs text-moncchichi-textSec opacity-50">Scroll for more...</span>}
                       </div>
                   </div>
               ) : (
                   pages.length > 0 ? (
                        readingMode === 'VERTICAL' ? (
                            <div className="w-full h-full overflow-y-auto bg-[#1a1a1a] no-scrollbar">
                                {pages.map((src, idx) => (
                                    <img key={idx} src={src} className="w-full max-w-2xl mx-auto" loading="lazy" referrerPolicy="no-referrer" />
                                ))}
                                <div className="p-8 flex justify-center pb-20">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onNextChapter(); }}
                                        className="px-6 py-3 bg-moncchichi-accent text-moncchichi-bg rounded-full font-bold shadow-lg hover:scale-105 transition-transform"
                                    >
                                        Continue to Next Chapter
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center relative">
                                {currentPage < pages.length ? (
                                    <img 
                                        src={pages[currentPage]} 
                                        className="max-w-full max-h-full object-contain" 
                                        referrerPolicy="no-referrer"
                                    />
                                ) : (
                                    <div className="text-center">
                                        <h3 className="text-white font-bold mb-4">Chapter Complete</h3>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onNextChapter(); }}
                                            className="px-6 py-3 bg-moncchichi-accent text-moncchichi-bg rounded-full font-bold shadow-lg"
                                        >
                                            Read Next Chapter
                                        </button>
                                    </div>
                                )}
                                {currentPage === pages.length - 1 && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onNextChapter(); }}
                                        className="absolute right-4 bottom-20 bg-moncchichi-accent/90 text-moncchichi-bg px-4 py-2 rounded-full font-bold text-sm shadow-lg animate-in slide-in-from-right-4"
                                    >
                                        Next Chapter &rarr;
                                    </button>
                                )}
                            </div>
                        )
                   ) : (
                       <div className="flex flex-col items-center justify-center h-full text-moncchichi-textSec gap-4 p-8 text-center animate-in fade-in">
                            <div className="p-4 bg-moncchichi-surfaceAlt rounded-full mb-2 border border-moncchichi-border"><Link2 size={32} className="opacity-50 text-moncchichi-error" /></div>
                            <h3 className="text-lg font-bold text-moncchichi-error">The Scroll is Sealed</h3>
                            <p className="text-sm max-w-xs leading-relaxed opacity-80">
                                This chapter is likely region-locked, external-only, or broken on the source server.
                            </p>
                            <div className="flex gap-3 mt-4">
                                <button onClick={(e) => { e.stopPropagation(); onBack(); }} className="px-6 py-2 bg-moncchichi-surface border border-moncchichi-border rounded-lg hover:bg-moncchichi-surfaceAlt text-sm font-bold transition-colors">Return</button>
                            </div>
                       </div>
                   )
               )
           ) : (
               <div className="w-full h-full overflow-y-auto p-8 pt-16 pb-16">
                   <div className="max-w-2xl mx-auto text-gray-300 text-lg leading-loose font-serif whitespace-pre-wrap">{pages[currentPage]}</div>
                   {currentPage === pages.length - 1 && (
                       <div className="text-center mt-8 pb-10">
                           <button 
                               onClick={(e) => { e.stopPropagation(); onNextChapter(); }}
                               className="px-6 py-3 bg-moncchichi-accent text-moncchichi-bg rounded-full font-bold shadow-lg"
                           >
                               Next Chapter
                           </button>
                       </div>
                   )}
               </div>
           )}
       </div>

       {!webViewUrl && !pdfBlobUrl && !activeBook.type.includes('AUDIO') && (activeBook.type === 'PDF' || activeBook.type === 'MANGA') && (
           <>
               <button 
                   onClick={handleSettingsToggle}
                   className={`absolute bottom-20 right-4 p-3 rounded-full bg-black/60 text-white backdrop-blur-sm border border-white/10 transition-all duration-300 z-30 ${settingsFocus ? 'opacity-100 scale-110 shadow-xl' : 'opacity-30 scale-100 hover:opacity-50'}`}
               >
                   <Settings size={20} />
               </button>
               {showSettings && (
                   <div className="absolute bottom-36 right-4 bg-moncchichi-surface border border-moncchichi-border rounded-xl shadow-2xl p-3 z-40 w-48 animate-in slide-in-from-bottom-4 fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                       <div className="flex justify-between items-center mb-2 pb-2 border-b border-moncchichi-border/50">
                           <span className="text-xs font-bold text-moncchichi-textSec uppercase">Reading Mode</span>
                           <button onClick={() => setShowSettings(false)} className="text-moncchichi-textSec hover:text-moncchichi-text"><X size={14}/></button>
                       </div>
                       <div className="flex flex-col gap-1">
                           <button 
                               onClick={() => { setReadingMode('HORIZONTAL'); setShowSettings(false); }}
                               className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${readingMode === 'HORIZONTAL' ? 'bg-moncchichi-accent text-moncchichi-bg' : 'hover:bg-moncchichi-surfaceAlt text-moncchichi-text'}`}
                           >
                               <MoveHorizontal size={14} /> Paged (Horizontal)
                           </button>
                           <button 
                               onClick={() => { setReadingMode('VERTICAL'); setShowSettings(false); }}
                               className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${readingMode === 'VERTICAL' ? 'bg-moncchichi-accent text-moncchichi-bg' : 'hover:bg-moncchichi-surfaceAlt text-moncchichi-text'}`}
                           >
                               <MoveVertical size={14} /> Scroll (Vertical)
                           </button>
                       </div>
                   </div>
               )}
           </>
       )}

       {/* Legacy Pagination Controls */}
       {!webViewUrl && !pdfBlobUrl && !activeBook.type.includes('AUDIO') && (activeBook.type !== 'MANGA' || (pages.length > 0 && readingMode === 'HORIZONTAL')) && pages.length > 0 && (
           <div className={`absolute bottom-0 w-full p-4 z-20 bg-gradient-to-t from-black/80 to-transparent transition-opacity ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
               <div className="flex items-center gap-4 text-white">
                   <button onClick={(e) => {e.stopPropagation(); onPageChange(-1)}} className="p-2 hover:bg-white/10 rounded-full"><ArrowLeft/></button>
                   <span className="flex-1 text-center text-xs font-mono">{currentPage+1} / {totalPages}</span>
                   <button onClick={(e) => {e.stopPropagation(); onPageChange(1)}} className="p-2 hover:bg-white/10 rounded-full"><ArrowRight/></button>
               </div>
           </div>
       )}
   </div>
    );
};

export default ReadingView;
