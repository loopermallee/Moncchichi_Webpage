
import { mockService } from './mockService';
import { storageService } from './storageService';
import { aiService } from './aiService';
import { mangakakalotService } from './mangakakalotService';
import { mangadexService } from './mangadexService';
import { anilistService } from './anilistService';
import { libgenService } from './libgenService';
import { consumetService, ConsumetProvider } from './consumetService';

export interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  description?: string;
  type: 'BOOK' | 'MANGA' | 'PDF' | 'AUDIO' | 'WEB';
  source: 'LOCAL' | 'NLB' | 'GUTENBERG' | 'MANGADEX' | 'GOOGLE' | 'COMICK' | 'MANGAKAKALOT' | 'STANDARD_EBOOKS' | 'OPEN_LIBRARY' | 'INTERNET_ARCHIVE' | 'LIBGEN' | 'CONSUMET';
  downloaded: boolean;
  progress: number;
  category?: string;
  tags?: string[];
  
  // Specific fields
  pdfAssetId?: string; // For Local PDF/Audio
  downloadUrl?: string; // For Manga/Web/Text/EPUB
  isSpoiled?: boolean; // If source is broken
  isDownloading?: boolean;
  downloadProgress?: number;
  content?: string; // Text content for eBooks
  pages?: string[]; // Image URLs for Manga/PDF pages (if rendered)
  mimeType?: string; // To distinguish between text/plain, application/pdf, application/epub+zip
  isMetadataAiGenerated?: boolean; // Indicates if metadata/cover was fetched by AI
  metadata?: {
    consumetProvider?: ConsumetProvider;
    consumetId?: string;
    [key: string]: any;
  };
}

export interface Chapter {
  id: string;
  title: string;
  sequence: number; // or string
  pages: number;
  language: string;
}

export interface DiscoverySection {
  title: string;
  books: Book[];
}

const CORS_PROXY = 'https://corsproxy.io/?';

class BookService {
  private listeners: (() => void)[] = [];
  private library: Book[] = [];
  private categories: string[] = ['Fiction', 'Non-Fiction', 'Sci-Fi', 'Reference'];
  private readHistory: Record<string, boolean> = {}; // key: "seriesId-chapterId"
  
  // Concurrency & Lifecycle tracking
  private searchController: AbortController | null = null;
  private activeDownloads: Set<string> = new Set();
  private searchRequestId = 0;

  constructor() {
    this.loadLibrary();
  }

  private async loadLibrary() {
    try {
      const storedLib = await storageService.getAllItems<Book>('library');
      if (storedLib && storedLib.length > 0) this.library = storedLib;
      
      const storedCats = await storageService.getCache<string[]>('user_categories');
      if (storedCats) this.categories = storedCats;

      const storedHistory = await storageService.getCache<Record<string, boolean>>('read_history');
      if (storedHistory) this.readHistory = storedHistory;
      
      this.notifyListeners();
    } catch (e) {
      console.warn("Failed to load library");
    }
  }

  public subscribe(cb: () => void) {
    this.listeners.push(cb);
    cb();
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l());
  }

  public getLibrary(): Book[] {
    return this.library;
  }

  public getCategories(): string[] {
    return this.categories;
  }

  public getBookById(id: string): Book | undefined {
    return this.library.find(b => b.id === id);
  }

  public async saveBook(book: Book) {
    const idx = this.library.findIndex(b => b.id === book.id);
    if (idx >= 0) {
        this.library[idx] = book;
    } else {
        this.library.push(book);
    }
    await storageService.saveItem('library', book);
    this.notifyListeners();
  }

  public async deleteBook(id: string) {
      this.library = this.library.filter(b => b.id !== id);
      await storageService.deleteItem('library', id);
      this.notifyListeners();
  }

  // --- Categories ---

  public addCategory(name: string) {
      if (!this.categories.includes(name)) {
          this.categories.push(name);
          this.persistCategories();
      }
  }

  public deleteCategory(name: string) {
      this.categories = this.categories.filter(c => c !== name);
      this.persistCategories();
  }

  public renameCategory(oldName: string, newName: string) {
      const idx = this.categories.indexOf(oldName);
      if (idx >= 0) {
          this.categories[idx] = newName;
          this.library.forEach(b => {
              if (b.category === oldName) {
                  b.category = newName;
                  storageService.saveItem('library', b);
              }
          });
          this.persistCategories();
      }
  }

  public moveCategoryUp(name: string) {
      const idx = this.categories.indexOf(name);
      if (idx > 0) {
          [this.categories[idx - 1], this.categories[idx]] = [this.categories[idx], this.categories[idx - 1]];
          this.persistCategories();
      }
  }

  public moveCategoryDown(name: string) {
      const idx = this.categories.indexOf(name);
      if (idx < this.categories.length - 1) {
          [this.categories[idx + 1], this.categories[idx]] = [this.categories[idx], this.categories[idx + 1]];
          this.persistCategories();
      }
  }

  public updateBookCategory(id: string, category: string) {
      const book = this.getBookById(id);
      if (book) {
          book.category = category;
          this.saveBook(book);
      }
  }

  private async persistCategories() {
      await storageService.setCache('user_categories', this.categories, 999999);
      this.notifyListeners();
  }

  // --- External Discovery ---

  private async fetchGutenbergBooks(category: string = ''): Promise<Book[]> {
      try {
          const url = `https://gutendex.com/books/?sort=popular${category ? '&topic=' + category : ''}`;
          const res = await fetch(url);
          const data = await res.json();
          
          return data.results.slice(0, 8).map((b: any) => ({
              id: `guten-${b.id}`,
              title: b.title,
              author: b.authors[0]?.name?.replace(/,/, '') || "Unknown",
              coverUrl: b.formats['image/jpeg'],
              downloadUrl: b.formats['text/plain; charset=utf-8'] || b.formats['text/plain'],
              description: `Project Gutenberg. ${b.download_count} downloads.`,
              type: 'BOOK',
              source: 'GUTENBERG',
              downloaded: false,
              progress: 0,
              mimeType: 'text/plain',
              tags: b.subjects.slice(0, 3).map((s: string) => s.split(' -- ')[0])
          })).filter((b: Book) => b.downloadUrl);
      } catch (e) {
          console.warn("Gutendex fetch failed", e);
          return [];
      }
  }

  private async fetchStandardEbooks(): Promise<Book[]> {
      try {
          const url = `${CORS_PROXY}${encodeURIComponent('https://standardebooks.org/opds/all')}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error("Status " + res.status);
          const text = await res.text();
          const parser = new DOMParser();
          const xml = parser.parseFromString(text, "text/xml");
          const entries = Array.from(xml.querySelectorAll("entry"));

          return entries.map(entry => {
              const title = entry.querySelector("title")?.textContent || "Unknown Title";
              const author = entry.querySelector("author > name")?.textContent || "Unknown Author";
              const summary = entry.querySelector("summary")?.textContent || "";
              const id = entry.querySelector("id")?.textContent || `se-${Math.random()}`;
              
              const links = Array.from(entry.querySelectorAll("link"));
              const coverLink = links.find(l => l.getAttribute("rel")?.includes("image/jpeg") || l.getAttribute("rel")?.includes("image/png") || l.getAttribute("href")?.endsWith('.jpg'))?.getAttribute("href");
              const downloadLink = links.find(l => l.getAttribute("rel")?.includes("acquisition") && l.getAttribute("type")?.includes("epub"))?.getAttribute("href");
              
              const fullCoverUrl = coverLink ? (coverLink.startsWith('http') ? coverLink : `https://standardebooks.org${coverLink}`) : undefined;
              const fullDownloadUrl = downloadLink ? (downloadLink.startsWith('http') ? downloadLink : `https://standardebooks.org${downloadLink}`) : undefined;

              return {
                  id: `se-${id.split('/').pop()}`,
                  title,
                  author,
                  description: summary,
                  coverUrl: fullCoverUrl,
                  downloadUrl: fullDownloadUrl,
                  type: 'BOOK',
                  source: 'STANDARD_EBOOKS',
                  downloaded: false,
                  progress: 0,
                  tags: ['Classic', 'Public Domain'],
                  mimeType: 'application/epub+zip'
              } as Book;
          }).filter(b => b.downloadUrl).slice(0, 10);
      } catch (e) {
          console.warn("Standard Ebooks OPDS fetch failed", e);
          return [];
      }
  }

  private async fetchOpenLibrary(subject: string): Promise<Book[]> {
      try {
          const url = `https://openlibrary.org/search.json?subject=${subject}&has_fulltext=true&limit=8`;
          const res = await fetch(url);
          const data = await res.json();

          return data.docs.map((doc: any) => {
              const coverId = doc.cover_i;
              const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : undefined;
              
              const iaId = doc.ia && doc.ia[0];
              const downloadUrl = iaId ? `https://archive.org/download/${iaId}/${iaId}.pdf` : undefined;

              return {
                  id: `ol-${doc.key.replace('/works/', '')}`,
                  title: doc.title,
                  author: doc.author_name ? doc.author_name[0] : "Unknown",
                  coverUrl,
                  description: `First published: ${doc.first_publish_year}.`,
                  type: 'PDF', 
                  source: 'OPEN_LIBRARY',
                  downloaded: false,
                  progress: 0,
                  downloadUrl: downloadUrl,
                  tags: doc.subject ? doc.subject.slice(0, 3) : [subject],
                  mimeType: 'application/pdf'
              } as Book;
          }).filter((b: Book) => b.downloadUrl);
      } catch (e) {
          console.warn("Open Library fetch failed", e);
          return [];
      }
  }

  private async fetchInternetArchive(): Promise<Book[]> {
      try {
          const query = 'collection:opensource_media AND mediatype:texts AND format:PDF';
          const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier,title,creator,description&rows=10&output=json&sort[]=downloads+desc`;
          
          const res = await fetch(url);
          const data = await res.json();
          
          return data.response.docs.map((doc: any) => ({
              id: `ia-${doc.identifier}`,
              title: doc.title,
              author: doc.creator || "Unknown",
              coverUrl: `https://archive.org/services/img/${doc.identifier}`,
              description: doc.description ? (Array.isArray(doc.description) ? doc.description[0] : doc.description) : "From Internet Archive.",
              type: 'PDF', 
              source: 'INTERNET_ARCHIVE',
              downloaded: false,
              progress: 0,
              downloadUrl: `https://archive.org/download/${doc.identifier}/${doc.identifier}.pdf`,
              tags: ['Archive'],
              mimeType: 'application/pdf'
          } as Book));
      } catch (e) {
          console.warn("Internet Archive fetch failed", e);
          return [];
      }
  }

  public async getDiscoverySections(): Promise<DiscoverySection[]> {
      const [
          trendingManga,
          popularManga,
          classicBooks,
          standardEbooks,
          thrillerBooks,
          archiveBooks
      ] = await Promise.all([
          anilistService.getTrendingManga(1, 10),
          mangakakalotService.getPopular(),
          this.fetchGutenbergBooks('fiction'),
          this.fetchStandardEbooks(),
          this.fetchOpenLibrary('thriller'),
          this.fetchInternetArchive()
      ]);

      const aniBooks: Book[] = trendingManga.map(m => ({
          id: `anilist-${m.id}`,
          title: m.title.english || m.title.romaji,
          author: "Unknown",
          description: m.description,
          coverUrl: m.coverImage.large,
          type: 'MANGA',
          source: 'MANGADEX', 
          downloaded: false,
          progress: 0,
          tags: m.genres
      }));

      const kakalotBooks: Book[] = popularManga.map(m => ({
          id: m.id,
          title: m.title,
          author: m.author,
          coverUrl: m.cover,
          description: "Popular on Mangakakalot",
          type: 'MANGA',
          source: 'MANGAKAKALOT',
          downloaded: false,
          progress: 0,
          downloadUrl: m.id
      }));

      return [
          { title: "Trending on MangaDex", books: aniBooks },
          { title: "Popular on Mangakakalot", books: kakalotBooks },
          { title: "Curated Ebooks", books: standardEbooks },
          { title: "Gutenberg Classics", books: classicBooks },
          { title: "Thriller (Open Library)", books: thrillerBooks },
          { title: "Archive Documents", books: archiveBooks }
      ];
  }

  public async searchExternalStream(query: string, callback: (books: Book[]) => void) {
      // Abort any ongoing search to prevent race conditions
      if (this.searchController) {
          this.searchController.abort();
      }
      this.searchController = new AbortController();
      const signal = this.searchController.signal;
      const requestId = ++this.searchRequestId;

      // 1. Gutenberg
      const gutenUrl = `https://gutendex.com/books/?search=${encodeURIComponent(query)}`;
      fetch(gutenUrl, { signal }).then(res => res.json()).then(data => {
          if (signal.aborted || requestId !== this.searchRequestId) return;
          const books: Book[] = data.results.map((b: any) => ({
              id: `guten-${b.id}`,
              title: b.title,
              author: b.authors[0]?.name?.replace(/,/, '') || "Unknown",
              coverUrl: b.formats['image/jpeg'],
              downloadUrl: b.formats['text/plain; charset=utf-8'] || b.formats['text/plain'],
              description: `Project Gutenberg.`,
              type: 'BOOK',
              source: 'GUTENBERG',
              downloaded: false,
              progress: 0,
              mimeType: 'text/plain',
              tags: b.subjects.slice(0, 2)
          })).filter((b: any) => b.downloadUrl).slice(0, 5);
          callback(books);
      }).catch((e) => { if (e.name !== 'AbortError') console.error("Gutenberg search failed", e); });

      // 2. Mangakakalot
      mangakakalotService.search(query).then(results => {
          if (signal.aborted || requestId !== this.searchRequestId) return;
          const books: Book[] = results.map(r => ({
              id: r.id,
              title: r.title,
              author: r.author,
              coverUrl: r.cover,
              type: 'MANGA',
              source: 'MANGAKAKALOT',
              downloaded: false,
              progress: 0,
              downloadUrl: r.id
          }));
          callback(books);
      });

      // 3. AniList (MangaDex proxy)
      anilistService.searchManga(query).then(media => {
          if (signal.aborted || requestId !== this.searchRequestId) return;
          if (media) {
              const book: Book = {
                  id: `anilist-${media.id}`,
                  title: media.title.english || media.title.romaji,
                  author: "Unknown",
                  description: media.description,
                  coverUrl: media.coverImage.large,
                  type: 'MANGA',
                  source: 'MANGADEX',
                  downloaded: false,
                  progress: 0,
                  tags: media.genres
              };
              callback([book]);
          }
      });

      // 4. LibGen
      if (query.length >= 4) {
          libgenService.search(query).then(results => {
              if (signal.aborted || requestId !== this.searchRequestId) return;
              const books: Book[] = results.map(b => ({
                  id: `lg-${b.id}`,
                  title: b.title,
                  author: b.author,
                  description: `${b.publisher ? b.publisher + '. ' : ''}${b.year ? b.year + '. ' : ''}${b.extension.toUpperCase()}, ${b.fileSize}`,
                  coverUrl: undefined, 
                  type: b.extension.toLowerCase() === 'pdf' ? 'PDF' : 'BOOK',
                  source: 'LIBGEN',
                  downloaded: false,
                  progress: 0,
                  downloadUrl: `https://library.lol/main/${b.id}`, 
                  mimeType: b.extension.toLowerCase() === 'pdf' ? 'application/pdf' : 'application/epub+zip',
                  tags: [b.extension.toUpperCase(), b.language]
              }));
              callback(books);
          }).catch(() => {});
      }

      // 5. Consumet (Multiple Providers)
      Promise.all([
          consumetService.searchManga(query, 'mangadex'),
          consumetService.searchManga(query, 'mangahere'),
          consumetService.searchManga(query, 'mangapill')
      ]).then(results => {
          if (signal.aborted || requestId !== this.searchRequestId) return;
          const allResults = results.flat();
          const books: Book[] = allResults.map((r, index) => {
              const provider: ConsumetProvider = index < results[0].length ? 'mangadex' 
                  : index < results[0].length + results[1].length ? 'mangahere' 
                  : 'mangapill';
              return this.mapConsumetResultToBook(r, provider);
          });
          if (books.length > 0) callback(books);
      }).catch(e => console.warn('[BookService] Consumet search failed:', e));
  }

  private mapConsumetResultToBook(result: any, provider: ConsumetProvider): Book {
    return {
        id: `consumet-${provider}-${result.id}`,
        title: result.title,
        author: 'Unknown',
        coverUrl: result.image,
        description: result.description || '',
        type: 'MANGA',
        source: 'CONSUMET',
        downloaded: false,
        progress: 0,
        tags: [provider.toUpperCase(), ...(result.status ? [result.status.toUpperCase()] : [])],
        metadata: {
            consumetProvider: provider,
            consumetId: result.id,
            releaseDate: result.releaseDate
        }
    };
  }

  // --- Local File Handling ---

  public async addLocalPdf(file: File, customTitle?: string, targetCategory?: string): Promise<Book> {
      const assetId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      await storageService.saveAsset(assetId, file);

      const name = file.name.toLowerCase();
      const isAudio = file.type.startsWith('audio/') || name.match(/\.(ogg|mp3|wav|m4a|aac)$/i);
      const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
      const isEpub = name.endsWith('.epub');
      
      const type: Book['type'] = isAudio ? 'AUDIO' : (isPdf ? 'PDF' : 'BOOK');
      const category = targetCategory || 'Unlisted';

      let title = customTitle || file.name;
      title = title.replace(/\.(pdf|ogg|mp3|wav|epub|m4a|aac)$/i, '');
      
      const newBook: Book = {
          id: assetId,
          title: title,
          author: 'Local Upload',
          description: `Uploaded file. Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`,
          type: type,
          source: 'LOCAL',
          downloaded: true,
          progress: 0,
          category: category,
          pdfAssetId: assetId,
          tags: isAudio ? ['Audio'] : [isPdf ? 'PDF' : (isEpub ? 'EPUB' : 'File')]
      };

      await this.saveBook(newBook);
      return newBook;
  }

  public async getPdfBlob(assetId: string): Promise<Blob | null> {
      return await storageService.getAssetBlob(assetId);
  }

  public async identifyLocalFile(book: Book): Promise<Book> {
      if (book.source !== 'LOCAL') return book;
      
      try {
          const prompt = `Identify this book/document based on filename: "${book.title}". Return JSON: { "title": "Real Title", "author": "Real Author", "tags": ["tag1", "tag2"], "description": "Short summary" }`;
          const result = await aiService.generateText({ userPrompt: prompt, temperature: 0.3 });
          const json = JSON.parse(result.text.replace(/```json/g, '').replace(/```/g, '').trim());
          
          const updated = {
              ...book,
              title: json.title || book.title,
              author: json.author || book.author,
              description: json.description || book.description,
              tags: json.tags || book.tags,
              isMetadataAiGenerated: true
          };
          await this.saveBook(updated);
          return updated;
      } catch (e) {
          return book;
      }
  }

  public async findCoverAndMetadata(book: Book): Promise<Book> {
      const cacheKey = `meta_${book.id}`;
      const cached = await storageService.getCache<Book>(cacheKey);
      if (cached) return { ...book, ...cached };

      let updatedBook = { ...book };
      
      try {
          const q = `intitle:${encodeURIComponent(book.title)}+inauthor:${encodeURIComponent(book.author)}`; 
          const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`);
          if (res.ok) {
              const data = await res.json();
              if (data.items && data.items.length > 0) {
                  const info = data.items[0].volumeInfo;
                  const coverUrl = info.imageLinks?.thumbnail?.replace('http:', 'https:') || info.imageLinks?.smallThumbnail?.replace('http:', 'https:');
                  if (coverUrl) {
                      updatedBook.coverUrl = coverUrl;
                      updatedBook.description = updatedBook.description || info.description || "";
                      updatedBook.tags = updatedBook.tags || info.categories || [];
                  }
              }
          }
      } catch (e) {}

      if (!updatedBook.coverUrl) {
          const enriched = await this.enrichBookMetadata(updatedBook, false);
          updatedBook = enriched;
      }

      if (updatedBook.coverUrl || updatedBook.description) {
          await storageService.setCache(cacheKey, updatedBook, 10080);
      }

      return updatedBook;
  }

  public async enrichBookMetadata(book: Book, saveToLibrary: boolean = true): Promise<Book> {
      if (book.type === 'MANGA') {
          const ani = await anilistService.searchManga(book.title);
          if (ani) {
              const updated = {
                  ...book,
                  description: ani.description || book.description,
                  coverUrl: book.coverUrl || ani.coverImage.extraLarge,
                  tags: ani.genres
              };
              if (saveToLibrary && this.getBookById(book.id)) await this.saveBook(updated);
              return updated;
          }
      }

      const prompt = `
      Search for the book "${book.title}" by "${book.author}".
      Provide a JSON object with:
      1. "description": A concise synopsis.
      2. "tags": An array of genres.
      ${!book.coverUrl ? '3. "coverUrl": A URL to a high-quality cover image.' : ''}
      `;

      try {
          const res = await aiService.generateText({ 
              userPrompt: prompt, 
              useSearch: true,
              temperature: 0.5 
          });
          const json = JSON.parse(res.text.replace(/```json/g, '').replace(/```/g, '').trim());
          const updated = { 
              ...book, 
              description: json.description || book.description, 
              tags: json.tags || book.tags,
              coverUrl: (!book.coverUrl && json.coverUrl) ? json.coverUrl : book.coverUrl,
              isMetadataAiGenerated: true
          };
          if (saveToLibrary && this.getBookById(book.id)) await this.saveBook(updated);
          return updated;
      } catch (e) { return book; }
  }

  // --- Manga / Reading ---

  public getSeriesId(bookId: string): string {
      if (bookId.includes('-ch')) return bookId.split('-ch')[0];
      return bookId;
  }

  public async getMangaChapters(mangaUrl: string, title?: string): Promise<Chapter[]> {
      const book = this.getBookById(mangaUrl);

      // Consumet logic
      if (book?.source === 'CONSUMET' && book.metadata?.consumetProvider && book.metadata?.consumetId) {
          const info = await consumetService.getMangaInfo(book.metadata.consumetId, book.metadata.consumetProvider);
          if (info?.chapters) {
              return info.chapters.map(ch => ({
                  id: ch.id,
                  title: ch.title || `Chapter ${ch.chapterNumber || ''}`,
                  sequence: parseFloat(ch.chapterNumber || '0') || 0,
                  pages: ch.pages || 0,
                  language: 'en'
              }));
          }
      }

      const isMangaDex = mangaUrl.startsWith('anilist') || (book && book.source === 'MANGADEX');

      if (isMangaDex) {
          const searchTitle = title || (book ? book.title : null);
          if (!searchTitle) return [];

          const mdId = await mangadexService.searchMangaId(searchTitle);
          if (mdId) {
              const chapters = await mangadexService.getAllChapters(mdId);
              return chapters.map(c => ({
                  id: c.id, 
                  title: c.title || `Chapter ${c.chapter}`,
                  sequence: parseFloat(c.chapter) || 0,
                  pages: c.pages || 0,
                  language: 'en'
              }));
          }
      }

      let urlToUse = mangaUrl;
      if (urlToUse.includes('anilist')) {
          const searchTitle = title || (book ? book.title : null);
          if (searchTitle) {
              const search = await mangakakalotService.search(searchTitle);
              if (search.length > 0) urlToUse = search[0].id;
              else return [];
          } else return [];
      }
      
      let chapters = await mangakakalotService.getChapters(urlToUse);
      if (chapters.length === 0 && title) {
          const search = await mangakakalotService.search(title);
          const validResult = search.find(r => r.id && !r.id.includes('undefined'));
          if (validResult) chapters = await mangakakalotService.getChapters(validResult.id);
      }

      const filtered = chapters.filter(c => {
          const t = c.title.toLowerCase();
          return !t.includes('raw') && !t.includes('bahasa') && !t.includes('indonesia');
      });

      return filtered.map(c => ({
          id: c.id, 
          title: c.title,
          sequence: parseFloat(c.chapterStr) || 0,
          pages: 0,
          language: 'en'
      }));
  }

  public async getMangaChapterPages(chapterUrlOrId: string): Promise<string[]> {
      const book = this.library.find(b => chapterUrlOrId.startsWith(b.id));
      if (book?.source === 'CONSUMET' && book.metadata?.consumetProvider) {
          return await consumetService.getChapterPages(chapterUrlOrId, book.metadata.consumetProvider);
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chapterUrlOrId);
      
      if (isUuid) {
          return await mangadexService.getPages(chapterUrlOrId);
      }
      return await mangakakalotService.getPages(chapterUrlOrId);
  }

  public isChapterRead(seriesId: string, chapterId: string): boolean {
      return !!this.readHistory[`${seriesId}-${chapterId}`];
  }

  public async toggleChapterRead(seriesId: string, chapterId: string, isRead: boolean) {
      if (isRead) this.readHistory[`${seriesId}-${chapterId}`] = true;
      else delete this.readHistory[`${seriesId}-${chapterId}`];
      await storageService.setCache('read_history', this.readHistory, 999999);
      this.notifyListeners();
  }

  public getDownloadedChapterCount(seriesId: string): number {
      return this.library.filter(b => b.id.startsWith(seriesId + '-ch') && b.downloaded).length;
  }

  public async downloadBook(book: Book, chapterId?: string) {
      const dlId = chapterId ? `${book.id}-ch${chapterId}` : book.id;
      
      if (this.activeDownloads.has(dlId)) {
          console.debug(`[BookService] Download already in progress: ${dlId}`);
          return;
      }

      // 1. Manga Download (Consumet / Generic)
      if (book.type === 'MANGA' && chapterId) {
          if (this.getBookById(dlId) && this.getBookById(dlId)!.downloaded) return;

          this.activeDownloads.add(dlId);
          const existingCh = this.getBookById(dlId);
          const newBook: Book = existingCh || {
              ...book,
              id: dlId,
              title: `${book.title} - Chapter`,
              downloaded: false,
              isDownloading: true,
              downloadProgress: 0,
              downloadUrl: chapterId
          };
          if (!existingCh) this.library.push(newBook);
          else { newBook.isDownloading = true; newBook.downloadProgress = 0; }
          this.notifyListeners();

          try {
              const pages = await this.getMangaChapterPages(chapterId);
              const cachedPages = [];
              let p = 0;
              for (const url of pages) {
                  const cachedUrl = await storageService.cacheImage(url);
                  cachedPages.push(cachedUrl);
                  p++;
                  newBook.downloadProgress = Math.round((p / pages.length) * 100);
                  this.notifyListeners();
              }
              newBook.pages = cachedPages;
              newBook.downloaded = true;
              newBook.isDownloading = false;
              await this.saveBook(newBook);
          } catch (e) {
              newBook.isDownloading = false;
              this.notifyListeners();
              console.error(`[BookService] Manga download failed: ${dlId}`, e);
          } finally {
              this.activeDownloads.delete(dlId);
          }
      } 
      
      // 2. Text Content (Gutenberg)
      else if (book.type === 'BOOK' && book.source === 'GUTENBERG' && book.downloadUrl && book.mimeType === 'text/plain') {
          const targetBook = this.getBookById(book.id) || book;
          if (targetBook.downloaded) return;

          this.activeDownloads.add(dlId);
          targetBook.isDownloading = true;
          targetBook.downloadProgress = 10;
          this.saveBook(targetBook);
          
          try {
              const proxyUrl = `${CORS_PROXY}${encodeURIComponent(book.downloadUrl)}`;
              const res = await fetch(proxyUrl);
              if (!res.ok) throw new Error("Download failed");
              const text = await res.text();
              targetBook.content = text;
              targetBook.downloaded = true;
              targetBook.isDownloading = false;
              targetBook.downloadProgress = 100;
              await this.saveBook(targetBook);
          } catch (e) {
              targetBook.isDownloading = false;
              targetBook.downloadProgress = 0;
              this.saveBook(targetBook);
              console.error(`[BookService] Text download failed: ${dlId}`, e);
          } finally {
              this.activeDownloads.delete(dlId);
          }
      }

      // 3. Binary (PDF/EPUB)
      else if (book.downloadUrl) {
          const targetBook = this.getBookById(book.id) || book;
          if (targetBook.downloaded) return;

          this.activeDownloads.add(dlId);
          targetBook.isDownloading = true;
          targetBook.downloadProgress = 10;
          this.saveBook(targetBook);

          try {
              let blob: Blob | null = null;
              
              const attempts = [
                  book.downloadUrl, 
                  `${CORS_PROXY}${encodeURIComponent(book.downloadUrl)}`, 
                  `https://api.allorigins.win/raw?url=${encodeURIComponent(book.downloadUrl)}` 
              ];

              for (const url of attempts) {
                  try {
                      const res = await fetch(url);
                      if (res.ok) {
                          blob = await res.blob();
                          break;
                      }
                  } catch (e) {}
              }

              if (!blob) throw new Error("Binary download failed after all attempts");
              
              const assetId = `file-${book.id}`;
              await storageService.saveAsset(assetId, blob);
              
              targetBook.pdfAssetId = assetId;
              targetBook.downloaded = true;
              targetBook.isDownloading = false;
              targetBook.downloadProgress = 100;
              
              if (book.mimeType === 'application/pdf' || book.downloadUrl.toLowerCase().endsWith('.pdf') || book.source === 'INTERNET_ARCHIVE' || book.source === 'OPEN_LIBRARY') {
                  targetBook.type = 'PDF';
              }

              await this.saveBook(targetBook);
          } catch (e) {
              console.error("Binary download failed", e);
              targetBook.isDownloading = false;
              targetBook.downloadProgress = 0;
              this.saveBook(targetBook);
          } finally {
              this.activeDownloads.delete(dlId);
          }
      }
  }

  public async ensureBookInLibrary(book: Book) {
      if (!this.getBookById(book.id)) {
          await this.saveBook(book);
      }
  }

  public updateProgress(id: string, progress: number) {
      const book = this.getBookById(id);
      if (book) {
          book.progress = progress;
          this.saveBook(book);
      }
  }

  public async findSubstituteCover(title: string): Promise<string | null> {
      const manga = await mangakakalotService.search(title);
      if (manga.length > 0) return manga[0].cover;
      return null;
  }

  public async searchLocalLibrary(query: string): Promise<Book[]> {
      const q = query.toLowerCase();
      return this.library.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
  }
}

export const bookService = new BookService();
