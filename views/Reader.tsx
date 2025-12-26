
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ICONS } from '../constants';
import { bookService, Book, Chapter, DiscoverySection } from '../services/bookService';
import { nlbService, NLBLibrary, NLBItem, ExploreSection } from '../services/nlbService';
import { protocolService } from '../services/protocolService';
import { Search, BookOpen, ChevronLeft, Sparkles, Building2, Globe, Library, Upload, Tv, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { ToastType } from '../components/Toast';

// Imported Components
import { CuteLoading, BookSkeleton } from '../components/reader/ReaderShared';
import { BookListCard, DiscoveryCard } from '../components/reader/BookCards';
import SummaryView from './reader/SummaryView';
import ReadingView from './reader/ReadingView';

import { GlobalWorkerOptions } from 'pdfjs-dist';
// Initialize PDF Worker
GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs`;

type ReaderMode = 'HOME' | 'LIBRARY' | 'BROWSE' | 'NLB' | 'READING' | 'SUMMARY';
type BrowseState = 'HOME' | 'RESULTS';
type NlbTab = 'SEARCH' | 'LOCATIONS' | 'FOR_YOU';
type ReadingDirection = 'HORIZONTAL' | 'VERTICAL';

const GENRES = [
    { id: 'fiction', label: 'Fiction', icon: <BookOpen size={16} />, color: 'bg-blue-500' },
    { id: 'science fiction', label: 'Sci-Fi', icon: <Sparkles size={16} />, color: 'bg-purple-500' },
    { id: 'mystery', label: 'Mystery', icon: <BookOpen size={16} />, color: 'bg-slate-600' },
    { id: 'history', label: 'History', icon: <BookOpen size={16} />, color: 'bg-amber-600' },
    { id: 'fantasy', label: 'Fantasy', icon: <Sparkles size={16} />, color: 'bg-emerald-500' },
    { id: 'manga', label: 'Manga', icon: <BookOpen size={16} />, color: 'bg-pink-500' },
    { id: 'tv', label: 'TV Shows', icon: <Tv size={16} />, color: 'bg-red-600' },
];

const NLB_GENRES = [
    { label: 'Fiction', query: 'Fiction' },
    { label: 'Non-Fiction', query: 'Non-Fiction' },
    { label: 'Business', query: 'Business' },
    { label: 'Self-Help', query: 'Self-Help' },
    { label: 'History', query: 'History' },
    { label: 'Sci-Fi', query: 'Science Fiction' },
    { label: 'Mystery', query: 'Mystery' },
    { label: 'Children', query: 'Children' },
];

export default function Reader({ onBack, onShowToast }: { onBack: () => void, onShowToast?: (msg: string, type: ToastType) => void }) {
  // State
  const [mode, setMode] = useState<ReaderMode>('HOME');
  const [previousMode, setPreviousMode] = useState<ReaderMode>('HOME'); 
  const [library, setLibrary] = useState<Book[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  
  // UI State
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Browse / Search State
  const [browseState, setBrowseState] = useState<BrowseState>('HOME');
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [homeSections, setHomeSections] = useState<DiscoverySection[]>([]);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [activeTagSearch, setActiveTagSearch] = useState<string | null>(null);
  
  // Summary View State
  const [selectedSeries, setSelectedSeries] = useState<Book | null>(null);
  const [chapterList, setChapterList] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [aiReview, setAiReview] = useState<string>("");
  const [loadingReview, setLoadingReview] = useState(false);

  // NLB State
  const [nlbTab, setNlbTab] = useState<NlbTab>('FOR_YOU'); // Default: FOR_YOU
  const [nlbQuery, setNlbQuery] = useState('');
  const [nlbSearchType, setNlbSearchType] = useState<'CATALOGUE' | 'ERESOURCE'>('CATALOGUE');
  const [nlbResults, setNlbResults] = useState<NLBItem[]>([]);
  const [nlbLibraries, setNlbLibraries] = useState<NLBLibrary[]>([]);
  const [nlbExploreData, setNlbExploreData] = useState<ExploreSection[]>([]);
  const [nlbLoading, setNlbLoading] = useState(false);
  const [viewNlbDetail, setViewNlbDetail] = useState<Book | null>(null); 
  
  const [nlbSearchError, setNlbSearchError] = useState<string | null>(null);
  const [nlbLocationStatus, setNlbLocationStatus] = useState<string>('loading');
  
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  
  // Reading State
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pages, setPages] = useState<string[]>([]);
  // Continuous Manga State
  const [loadedChapters, setLoadedChapters] = useState<{ id: string, title: string, pages: string[] }[]>([]);
  const [loadingNextChapter, setLoadingNextChapter] = useState(false);

  const [showControls, setShowControls] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  
  // PDF State (Canvas rendering)
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfPagesRendered, setPdfPagesRendered] = useState<number[]>([]);
  
  const [readingMode, setReadingMode] = useState<ReadingDirection>('HORIZONTAL');
  const [settingsFocus, setSettingsFocus] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [transitioningChapter, setTransitioningChapter] = useState<string | null>(null);
  const [showEndOfSeries, setShowEndOfSeries] = useState(false);
  const [chapterAnnouncement, setChapterAnnouncement] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  useEffect(() => {
    const unsub = bookService.subscribe(() => {
        setLibrary([...bookService.getLibrary()]);
        setCustomCategories([...bookService.getCategories()]);
    });
    setLibrary([...bookService.getLibrary()]);
    setCustomCategories([...bookService.getCategories()]);
    
    const loadContent = async () => {
        setLoadingPopular(true);
        try {
            const sections = await bookService.getDiscoverySections();
            setHomeSections(sections);
        } catch (e) {
        } finally {
            setLoadingPopular(false);
        }
    };
    loadContent();
    
    nlbService.getLibraries()
        .then(libs => {
            setNlbLibraries(libs);
            setNlbLocationStatus('ok');
        })
        .catch(e => {
            if (e.message === "REDIRECT_ERROR") setNlbLocationStatus('redirect');
            else if (e.message === "MISSING_CREDENTIALS") setNlbLocationStatus('missing');
            else setNlbLocationStatus('error');
        });
    
    return unsub;
  }, []);

  // NLB For You - Enrich covers
  useEffect(() => {
      if (mode === 'NLB' && nlbTab === 'FOR_YOU' && nlbExploreData.length === 0) {
          setNlbLoading(true);
          let active = true;

          nlbService.getExploreContent().then(async (data) => {
              if (!active) return;
              setNlbExploreData(data);
              setNlbLoading(false);
              
              // Batch enrichment
              const allBooks = data.flatMap(s => s.books);
              const BATCH_SIZE = 4;
              for (let i = 0; i < allBooks.length; i += BATCH_SIZE) {
                  if (!active) break;
                  const batch = allBooks.slice(i, i + BATCH_SIZE);
                  const results = await Promise.all(batch.map(b => bookService.findCoverAndMetadata(b)));
                  
                  if (!active) break;
                  setNlbExploreData(prev => {
                      const next = [...prev];
                      results.forEach(enriched => {
                          for (const section of next) {
                              const idx = section.books.findIndex(b => b.id === enriched.id);
                              if (idx !== -1) section.books[idx] = enriched;
                          }
                      });
                      return next;
                  });
              }
          }).catch(() => {
              if (active) setNlbLoading(false);
          });

          return () => { active = false; };
      }
  }, [mode, nlbTab, nlbExploreData.length]);

  // Handlers
  const groupedLibrary = useMemo(() => {
      const groups: Record<string, Book[]> = {};
      const allCats = new Set([...customCategories, 'Ebooks', 'Manga', 'Audio', 'Unlisted']);
      allCats.forEach(c => groups[c] = []);
      
      library.forEach(book => {
          let cat = book.category || 'Unlisted';
          if (!groups[cat]) {
              if (book.type === 'AUDIO') cat = 'Audio';
              else if (book.type === 'MANGA') cat = 'Manga';
              else cat = 'Ebooks';
          }
          if (groups[cat]) groups[cat].push(book);
          else groups['Unlisted'].push(book);
      });
      return groups;
  }, [library, customCategories]);

  // --- Handlers ---

  const handleReadFromBeginning = () => {
      if (!selectedSeries) return;
      if (selectedSeries.type === 'MANGA') {
          if (chapterList.length > 0) {
              const sorted = [...chapterList].sort((a, b) => a.sequence - b.sequence);
              handleChapterAction(sorted[0], 'READ');
          }
      } else {
          openBook(selectedSeries);
      }
  };

  const handleDownloadAll = () => {
      if (!selectedSeries) return;
      if (onShowToast) onShowToast(`Queuing ${chapterList.length} items...`, "info");
      chapterList.forEach(ch => {
          bookService.downloadBook(selectedSeries, ch.id);
      });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;
      const incomingFiles = Array.from(fileList) as File[];
      
      let count = 0;
      for (const file of incomingFiles) {
          try {
              await bookService.addLocalPdf(file, undefined, 'Unlisted');
              count++;
          } catch(err) {
              console.error(err);
          }
      }
      if (onShowToast && count > 0) onShowToast(`Imported ${count} files.`, "success");
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRenameSave = (cat: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (renameValue.trim() && renameValue !== cat) {
          bookService.renameCategory(cat, renameValue);
      }
      setEditingCategory(null);
  };

  const handleNlbSearch = async (overrideQuery?: string) => {
      const q = overrideQuery || nlbQuery;
      if (!q.trim()) return;
      setNlbLoading(true);
      setNlbSearchError(null);
      setNlbResults([]);
      
      try {
          let results: NLBItem[] = [];
          if (nlbSearchType === 'CATALOGUE') {
              results = await nlbService.searchCatalogue(q);
          } else {
              results = await nlbService.searchEResources(q);
          }
          setNlbResults(results);
      } catch (e: any) {
          setNlbSearchError(e.message || "Search failed");
          if (onShowToast) onShowToast(e.message || "Search failed", "error");
      } finally {
          setNlbLoading(false);
      }
  };

  const mapNlbToBook = (item: NLBItem): Book => ({
      id: item.id,
      title: item.title,
      author: item.author,
      description: item.description,
      type: 'BOOK',
      source: 'NLB' as any,
      downloaded: false,
      progress: 0,
      tags: [item.format, item.availabilityStatus],
      coverUrl: item.coverUrl
  });

  const handleBookClick = async (book: Book) => {
      setPreviousMode(mode);
      const existingBook = bookService.getBookById(book.id);
      const targetBook = existingBook || book;

      if (targetBook.source === 'NLB' as any) {
          setMode('NLB');
          setViewNlbDetail(targetBook); 
          return;
      }

      if (targetBook.type === 'MANGA') {
          setSelectedSeries(targetBook);
          setMode('SUMMARY');
          setLoadingChapters(true);
          setChapterList([]);
          setShowEndOfSeries(false);
          try {
              if (!existingBook) await bookService.ensureBookInLibrary(targetBook);
              const chapters = await bookService.getMangaChapters(targetBook.downloadUrl || targetBook.id, targetBook.title);
              setChapterList(chapters);
              if (chapters.length === 0) {
                  const spoiledBook = { ...targetBook, isSpoiled: true };
                  setSelectedSeries(spoiledBook);
                  if (existingBook) {
                      existingBook.isSpoiled = true;
                      await bookService.saveBook(existingBook);
                  }
              }
          } catch (e) {
              if(onShowToast) onShowToast("Could not load chapters", "error");
          } finally {
              setLoadingChapters(false);
          }
          return;
      }
      
      if ((targetBook.type === 'BOOK' || targetBook.type === 'PDF') && !targetBook.downloaded && !targetBook.content && (targetBook.source === 'GUTENBERG' || targetBook.source === 'STANDARD_EBOOKS' || targetBook.source === 'OPEN_LIBRARY' || targetBook.source === 'INTERNET_ARCHIVE')) {
          try {
              if(onShowToast) onShowToast("Downloading book...", "info");
              await bookService.downloadBook(targetBook);
              const updated = bookService.getBookById(targetBook.id) || targetBook;
              openBook(updated);
          } catch(e) {
              if(onShowToast) onShowToast("Download failed", "error");
          }
          return;
      }
      openBook(targetBook);
  };

  const openBook = async (book: Book) => {
      if (book.isDownloading) return;
      setActiveBook(book);
      setMode('READING');
      setShowControls(true);
      setIsLoadingContent(true);
      setWebViewUrl(null);
      setPdfDoc(null);
      setPdfBlobUrl(null);
      setPdfPagesRendered([]);
      setPages([]);
      setLoadedChapters([]);
      setChapterAnnouncement(null);

      try {
          if (book.type === 'AUDIO') {
              setIsLoadingContent(false);
              return;
          }
          if (book.type === 'PDF' && book.pdfAssetId) {
              const blob = await bookService.getPdfBlob(book.pdfAssetId);
              if (blob) {
                  const doc = await protocolService.loadPdfDocument(blob);
                  setPdfDoc(doc);
                  setTotalPages(doc.numPages);
                  setPdfPagesRendered(Array.from({length: doc.numPages}, (_, i) => i + 1));
                  setReadingMode('VERTICAL');
                  const url = URL.createObjectURL(blob);
                  setPdfBlobUrl(url);
              } else throw new Error("PDF Blob not found");
              setIsLoadingContent(false);
              return;
          }
          if (book.type === 'WEB' && book.downloadUrl) {
              setWebViewUrl(book.downloadUrl);
              setIsLoadingContent(false);
              return;
          }
          if (book.type === 'MANGA') {
              const pgs = book.pages || [];
              if (pgs.length > 0) {
                  setLoadedChapters([{ id: book.id, title: book.title, pages: pgs }]);
                  setIsLoadingContent(false);
              } else if (book.downloadUrl) {
                  const pgs = await bookService.getMangaChapterPages(book.downloadUrl);
                  setLoadedChapters([{ id: book.downloadUrl, title: book.title, pages: pgs }]);
                  setIsLoadingContent(false);
              } else {
                  setIsLoadingContent(false);
              }
          } else {
              let content = book.content;
              if (!content && book.downloadUrl && (book.source === 'GUTENBERG' || book.source === 'STANDARD_EBOOKS')) {
                  if (!book.downloaded) {
                       await bookService.downloadBook(book);
                       const refreshed = bookService.getBookById(book.id);
                       content = refreshed?.content;
                  }
              }
              content = content || book.description || "No content found.";
              const fontSize = 18;
              const charsPerPage = Math.floor(40000 / fontSize); 
              const chunks = [];
              for (let i = 0; i < content.length; i += charsPerPage) {
                  chunks.push(content.substring(i, i + charsPerPage));
              }
              setPages(chunks);
              setTotalPages(chunks.length);
              const start = Math.floor((book.progress / 100) * (chunks.length - 1)) || 0;
              setCurrentPage(start);
              setIsLoadingContent(false);
          }
      } catch (e) {
          if(onShowToast) onShowToast("Failed to open book", "error");
          setIsLoadingContent(false);
      }
  };

  const handleChapterAction = async (chapter: Chapter, action: 'READ' | 'DOWNLOAD') => {
      if (!selectedSeries) return;
      if (action === 'READ') {
          await bookService.toggleChapterRead(selectedSeries.id, chapter.id, true);
          setMode('READING');
          setShowControls(true);
          setPages([]); 
          setLoadedChapters([]); 
          setTotalPages(0);
          setWebViewUrl(null);
          setIsLoadingContent(true);
          setChapterAnnouncement(null);
          
          const tempBook: Book = {
              ...selectedSeries,
              id: `${selectedSeries.id}-ch${chapter.id}`,
              title: `${selectedSeries.title} - ${chapter.title}`,
              type: 'MANGA',
              progress: 0,
              downloaded: false
          };
          setActiveBook(tempBook);

          try {
              const pgs = await bookService.getMangaChapterPages(chapter.id);
              if (!pgs || pgs.length === 0) throw new Error("No pages found");
              setLoadedChapters([{ id: chapter.id, title: chapter.title, pages: pgs }]);
              setPages(pgs);
              setTotalPages(pgs.length);
              setCurrentPage(0);
          } catch (e) {
              setPages([]);
              setLoadedChapters([]);
          } finally {
              setIsLoadingContent(false);
          }
      } else {
          bookService.downloadBook(selectedSeries, chapter.id);
          if(onShowToast) onShowToast("Download started", "info");
      }
  };

  const handleSearch = (query: string, isTag: boolean = false) => {
      if (!query.trim()) return;
      setIsSearching(true);
      setBrowseState('RESULTS');
      if (isTag) setActiveTagSearch(query);
      else setActiveTagSearch(null);
      
      bookService.searchExternalStream(query, (results) => {
          setSearchResults(prev => {
              const combined = [...prev, ...results];
              return Array.from(new Map(combined.map(item => [item.id, item])).values());
          });
          setIsSearching(false);
      });
  };

  const handleNavigation = () => {
      if (mode === 'READING') {
          if (activeBook?.source === 'LOCAL') setMode('LIBRARY');
          else if (activeBook?.type === 'MANGA') setMode('SUMMARY'); 
          else setMode(previousMode);
          setActiveBook(null);
          setPdfDoc(null);
          return;
      }
      if (mode === 'SUMMARY') {
          setMode(previousMode);
          setSelectedSeries(null);
          return;
      }
      if (mode === 'BROWSE' && browseState === 'RESULTS') {
          setBrowseState('HOME');
          setSearchResults([]);
          setSearchQuery('');
          setActiveTagSearch(null);
          return;
      }
      if (mode === 'NLB' && viewNlbDetail) {
          setViewNlbDetail(null);
          return;
      }
      if (mode !== 'HOME') {
          setMode('HOME');
          return;
      }
      onBack();
  };

  return (
    <div className="flex flex-col h-full bg-moncchichi-bg text-moncchichi-text">
      {mode === 'READING' && activeBook ? (
          <ReadingView 
              activeBook={activeBook}
              pages={pages}
              pdfDoc={pdfDoc}
              pdfBlobUrl={pdfBlobUrl}
              loadedChapters={loadedChapters}
              loadingNextChapter={loadingNextChapter}
              showEndOfSeries={showEndOfSeries}
              onBack={handleNavigation}
              onBookmark={() => bookService.updateProgress(activeBook.id, Math.round((currentPage/totalPages)*100))}
              onSendToGlasses={() => {}}
              onNextChapter={() => {}}
              onPrevChapter={() => {}}
              onPageChange={() => {}}
              currentPage={currentPage}
              totalPages={totalPages}
              transitioningChapter={transitioningChapter}
              chapterAnnouncement={chapterAnnouncement}
              showControls={showControls}
              setShowControls={setShowControls}
              isLoadingContent={isLoadingContent}
              webViewUrl={webViewUrl}
              readingMode={readingMode}
              setReadingMode={setReadingMode}
              settingsFocus={settingsFocus}
              setSettingsFocus={setSettingsFocus}
              showSettings={showSettings}
              setShowSettings={setShowSettings}
              bottomSentinelRef={bottomSentinelRef}
              containerRef={containerRef}
              pdfPagesRendered={pdfPagesRendered}
              showCastButton={false} 
          />
      ) : mode === 'SUMMARY' && selectedSeries ? (
          <SummaryView 
              book={selectedSeries}
              chapterList={chapterList}
              loadingChapters={loadingChapters}
              aiReview={aiReview}
              loadingReview={loadingReview}
              onBack={handleNavigation}
              onRead={handleReadFromBeginning}
              onDownloadAll={handleDownloadAll}
              onChapterAction={handleChapterAction}
              library={library}
              onTagClick={(tag) => { setSearchQuery(tag); setActiveTagSearch(tag); setMode('BROWSE'); handleSearch(tag, false); }}
          />
      ) : (
        <>
            <div className="px-4 py-3 border-b border-moncchichi-border bg-moncchichi-surface flex items-center gap-3 sticky top-0 z-40 shadow-sm">
                <button onClick={handleNavigation} className="p-2 -ml-2 text-moncchichi-textSec hover:text-moncchichi-text rounded-full hover:bg-moncchichi-surfaceAlt transition-colors">
                    {mode === 'HOME' ? ICONS.Back : <ChevronLeft size={20} />}
                </button>
                <div className="flex-1">
                <h2 className="text-lg font-bold text-moncchichi-text tracking-tight flex items-center gap-2">
                    <BookOpen size={20} className="text-moncchichi-accent"/> Grimoire
                </h2>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* HOME View */}
                {mode === 'HOME' && (
                    <div className="p-4 space-y-6 animate-in fade-in pb-20">
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setMode('LIBRARY')} className="p-4 bg-moncchichi-surface border border-moncchichi-border rounded-xl hover:bg-moncchichi-surfaceAlt text-left flex flex-col gap-2 transition-colors group">
                                <Library className="text-moncchichi-accent group-hover:scale-110 transition-transform" />
                                <div><div className="font-bold text-sm">Library</div><div className="text-[10px] text-moncchichi-textSec">{library.length} Downloaded</div></div>
                            </button>
                            <button onClick={() => { setMode('BROWSE'); setBrowseState('HOME'); }} className="p-4 bg-moncchichi-surface border border-moncchichi-border rounded-xl hover:bg-moncchichi-surfaceAlt text-left flex flex-col gap-2 transition-colors group">
                                <Globe className="text-blue-400 group-hover:scale-110 transition-transform" />
                                <div><div className="font-bold text-sm">Browse</div><div className="text-[10px] text-moncchichi-textSec">Search Online</div></div>
                            </button>
                            <button onClick={() => setMode('NLB')} className="col-span-2 p-4 bg-moncchichi-surface border border-moncchichi-border rounded-xl hover:bg-moncchichi-surfaceAlt text-left flex items-center gap-4 transition-colors group">
                                <Building2 className="text-red-500 group-hover:scale-110 transition-transform" />
                                <div><div className="font-bold text-sm">NLB Gateway</div><div className="text-[10px] text-moncchichi-textSec">National Library Board Services</div></div>
                            </button>
                            {/* Caverns of Time TV Button */}
                            <button onClick={() => { setMode('BROWSE'); handleSearch('tv', true); }} className="col-span-2 p-4 bg-moncchichi-surface border border-moncchichi-border rounded-xl hover:bg-moncchichi-surfaceAlt text-left flex items-center gap-4 transition-colors group">
                                <Tv className="text-purple-500 group-hover:scale-110 transition-transform" />
                                <div><div className="font-bold text-sm">Caverns of Time</div><div className="text-[10px] text-moncchichi-textSec">WoW TV & Streaming</div></div>
                            </button>
                        </div>

                        {loadingPopular && homeSections.length === 0 ? (
                            <div className="py-10 flex justify-center">
                                <CuteLoading label="Summoning Archives..." />
                            </div>
                        ) : (
                            homeSections.map((section, idx) => (
                                <div key={idx} className="animate-in fade-in slide-in-from-bottom-2" style={{animationDelay: `${idx * 100}ms`}}>
                                        <h3 className="text-xs font-bold text-moncchichi-textSec uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <Sparkles size={12} className="text-yellow-500"/> {section.title}
                                        </h3>
                                        <div className="flex overflow-x-auto gap-3 pb-4 -mx-4 px-4 no-scrollbar">
                                            {section.books.map((book) => (
                                                <DiscoveryCard key={book.id} book={book} onClick={handleBookClick} />
                                            ))}
                                        </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* LIBRARY View */}
                {mode === 'LIBRARY' && (
                    <div className="flex flex-col h-full animate-in fade-in">
                        <div className="px-4 py-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xs font-bold text-moncchichi-textSec uppercase tracking-wider">Local Collection</h3>
                                    <input type="file" accept=".pdf,.epub,.cbz,.cbr,.mp3,.ogg,.wav" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()} 
                                        className="bg-moncchichi-accent text-moncchichi-bg px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:brightness-110 transition-all shadow-lg shadow-moncchichi-accent/20 active:scale-95"
                                    >
                                        <Upload size={14} /> Upload File
                                    </button>
                                </div>

                                <div className="space-y-4 pb-20">
                                    {Array.from(new Set([...customCategories, 'Ebooks', 'Manga', 'Audio', 'Unlisted'])).map(cat => {
                                        const items = groupedLibrary[cat];
                                        const isEmpty = !items || items.length === 0;
                                        if (isEmpty) return null;

                                        const isCollapsed = collapsedCategories[cat];

                                        return (
                                            <div key={cat} className="bg-moncchichi-surface/20 rounded-xl border border-moncchichi-border/30 overflow-hidden">
                                                <div 
                                                    className="flex items-center gap-2 p-3 cursor-pointer hover:bg-moncchichi-surfaceAlt/50 transition-colors"
                                                    onClick={() => setCollapsedCategories(prev => ({...prev, [cat]: !prev[cat]}))}
                                                >
                                                    {editingCategory === cat ? (
                                                        <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                                                            <input 
                                                                value={renameValue}
                                                                onChange={(e) => setRenameValue(e.target.value)}
                                                                className="bg-moncchichi-bg border border-moncchichi-accent rounded px-2 py-1 text-sm flex-1 focus:outline-none"
                                                                autoFocus
                                                            />
                                                            <button onClick={(e) => handleRenameSave(cat, e)} className="p-1 text-moncchichi-success"><Check size={14}/></button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <span className="text-sm font-bold text-moncchichi-text">{cat}</span>
                                                            <span className="text-[10px] bg-moncchichi-surfaceAlt px-2 rounded-full text-moncchichi-textSec">{items ? items.length : 0}</span>
                                                        </>
                                                    )}
                                                    
                                                    <div className="ml-auto flex items-center gap-2">
                                                        <div className="text-moncchichi-textSec">
                                                            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {!isCollapsed && (
                                                    <div className="p-3 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in slide-in-from-top-2">
                                                        {items.map(book => (
                                                            <BookListCard 
                                                                key={book.id} 
                                                                book={book} 
                                                                onClick={handleBookClick} 
                                                                categories={['Ebooks', 'Manga', 'Audio', ...customCategories]}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                        </div>
                    </div>
                )}

                {/* BROWSE View */}
                {mode === 'BROWSE' && (
                    <div className="flex flex-col min-h-full">
                        <div className="sticky top-0 z-[60] bg-moncchichi-bg/95 backdrop-blur-sm px-4 py-3 border-b border-moncchichi-border/50 flex gap-2">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-moncchichi-textSec" size={16} />
                                <input 
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                                    placeholder={activeTagSearch ? `Filtering: ${activeTagSearch}` : "Search Manga, Books, TV..."}
                                    className={`w-full bg-moncchichi-surface border rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-moncchichi-accent text-moncchichi-text ${activeTagSearch ? 'border-moncchichi-accent/50 ring-1 ring-moncchichi-accent/20' : 'border-moncchichi-border'}`}
                                />
                            </div>
                            <button onClick={() => handleSearch(searchQuery)} className="bg-moncchichi-accent text-moncchichi-bg px-4 rounded-xl font-bold text-sm">Go</button>
                        </div>

                        <div className="p-4 flex-1">
                            {browseState === 'HOME' ? (
                                <div className="grid grid-cols-2 gap-3">
                                    {GENRES.map(g => (
                                        <button key={g.id} onClick={() => handleSearch(g.id, true)} className="p-4 bg-moncchichi-surface border border-moncchichi-border rounded-xl flex items-center gap-3 hover:bg-moncchichi-surfaceAlt transition-colors">
                                            <div className={`p-2 rounded-full ${g.color} text-white`}>{g.icon}</div>
                                            <span className="font-bold text-sm">{g.label}</span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {activeTagSearch && (
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-moncchichi-textSec">Filtering: <span className="font-bold text-moncchichi-accent">{activeTagSearch}</span></span>
                                            <button onClick={() => { setActiveTagSearch(null); setSearchQuery(''); handleSearch(''); }} className="text-[10px] text-moncchichi-error hover:underline">Clear Filter</button>
                                        </div>
                                    )}
                                    {isSearching && searchResults.length === 0 ? (
                                        <div className="space-y-3">
                                            {[1, 2, 3, 4, 5].map(i => <BookSkeleton key={i} />)}
                                        </div>
                                    ) : (
                                        <>
                                            {searchResults.map((b, i) => (
                                                <div key={b.id} className="animate-in slide-in-from-bottom-2" style={{animationDelay: `${i * 50}ms`}}>
                                                    <BookListCard book={b} onClick={handleBookClick} />
                                                </div>
                                            ))}
                                            {searchResults.length === 0 && !isSearching && (
                                                <div className="text-center py-10 text-moncchichi-textSec opacity-50">
                                                    <p>No results found.</p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* NLB View */}
                {mode === 'NLB' && !viewNlbDetail && (
                    <div className="flex flex-col h-full">
                        <div className="px-4 py-2 border-b border-moncchichi-border bg-moncchichi-surface/50">
                            <div className="flex p-1 bg-moncchichi-surfaceAlt rounded-lg border border-moncchichi-border">
                                <button onClick={() => setNlbTab('FOR_YOU')} className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${nlbTab === 'FOR_YOU' ? 'bg-moncchichi-text text-moncchichi-bg' : 'text-moncchichi-textSec'}`}>For You</button>
                                <button onClick={() => setNlbTab('SEARCH')} className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${nlbTab === 'SEARCH' ? 'bg-moncchichi-text text-moncchichi-bg' : 'text-moncchichi-textSec'}`}>Search</button>
                                <button onClick={() => setNlbTab('LOCATIONS')} className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${nlbTab === 'LOCATIONS' ? 'bg-moncchichi-text text-moncchichi-bg' : 'text-moncchichi-textSec'}`}>Locations</button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {nlbTab === 'FOR_YOU' && (
                                <div className="space-y-6 pb-10">
                                    {nlbLoading && nlbExploreData.length === 0 ? (
                                        <div className="space-y-4">
                                            <BookSkeleton />
                                            <BookSkeleton />
                                            <BookSkeleton />
                                        </div>
                                    ) : (
                                        <>
                                            {nlbExploreData.map((section, idx) => (
                                                <div key={idx} className="animate-in fade-in slide-in-from-bottom-2" style={{animationDelay: `${idx * 100}ms`}}>
                                                    <h3 className="text-xs font-bold text-moncchichi-textSec uppercase tracking-wider mb-2 flex items-center gap-2">
                                                        <Sparkles size={12} className="text-moncchichi-accent"/> {section.title}
                                                    </h3>
                                                    <div className="flex overflow-x-auto gap-3 pb-4 -mx-4 px-4 no-scrollbar">
                                                        {section.books.map((book) => (
                                                            <DiscoveryCard key={book.id} book={book} onClick={handleBookClick} />
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                            
                            {nlbTab === 'SEARCH' && (
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <input 
                                            value={nlbQuery} 
                                            onChange={e => setNlbQuery(e.target.value)} 
                                            onKeyDown={e => e.key === 'Enter' && handleNlbSearch()}
                                            placeholder="Search Catalogue..."
                                            className="flex-1 bg-moncchichi-surface border border-moncchichi-border rounded-xl px-3 py-2 text-sm focus:outline-none" 
                                        />
                                        <button onClick={() => handleNlbSearch()} className="bg-moncchichi-accent text-moncchichi-bg px-4 rounded-xl font-bold text-sm">Find</button>
                                    </div>
                                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                                        {NLB_GENRES.map(g => (
                                            <button key={g.label} onClick={() => handleNlbSearch(g.query)} className="whitespace-nowrap px-3 py-1 bg-moncchichi-surfaceAlt border border-moncchichi-border rounded-lg text-xs font-bold text-moncchichi-textSec hover:text-moncchichi-text hover:border-moncchichi-accent transition-colors">
                                                {g.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="space-y-3 pb-20">
                                        {nlbResults.map(item => (
                                            <BookListCard key={item.id} book={mapNlbToBook(item)} onClick={handleBookClick} />
                                        ))}
                                        {nlbLoading && (
                                            <div className="space-y-3">
                                                {[1, 2, 3].map(i => <BookSkeleton key={i} />)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {nlbTab === 'LOCATIONS' && (
                                <div className="space-y-3 pb-20">
                                    {nlbLibraries.map(lib => (
                                        <div key={lib.branchCode} className="bg-moncchichi-surface p-3 rounded-xl border border-moncchichi-border flex justify-between">
                                            <span className="text-sm font-bold">{lib.branchName}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded ${lib.status === 'OPEN' ? 'bg-moncchichi-success/10 text-moncchichi-success' : 'bg-moncchichi-error/10 text-moncchichi-error'}`}>{lib.status}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
      )}
    </div>
  );
};
