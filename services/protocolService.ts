
import { bookService, Book } from './bookService';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { mockService } from './mockService';

// Initialize Worker via CDN for client-side parsing
GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs`;

export interface ProtocolMatch {
    bookId: string;
    bookTitle: string;
    pageIndex: number; // 1-based index for UI
    context: string; // Text snippet
}

export type SearchEvent = 
    | { type: 'START_FILE'; fileName: string }
    | { type: 'MATCHES'; matches: ProtocolMatch[] }
    | { type: 'FILE_COMPLETE'; fileName: string; matchCount: number }
    | { type: 'COMPLETE' };

class ProtocolService {
    
    // --- PDF Document Loading ---
    public async loadPdfDocument(blob: Blob): Promise<any> {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const loadingTask = getDocument({ data: arrayBuffer });
            return await loadingTask.promise;
        } catch (e: any) {
            mockService.emitLog("CODEX", "ERROR", `PDF Load Failed: ${e.message}`);
            throw e;
        }
    }
    
    // --- PDF Text Extraction & Search ---
    
    public async getPageText(book: Book, pageIndex: number): Promise<{ text: string, totalPages: number }> {
        if (book.type !== 'PDF' || !book.pdfAssetId) return { text: "Not a PDF", totalPages: 0 };

        const blob = await bookService.getPdfBlob(book.pdfAssetId);
        if (!blob) {
            mockService.emitLog("CODEX", "WARN", `Blob missing for ${book.title}`);
            return { text: "File content missing.", totalPages: 0 };
        }

        try {
            const arrayBuffer = await blob.arrayBuffer();
            const loadingTask = getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            const totalPages = pdf.numPages;
            
            if (pageIndex < 1 || pageIndex > totalPages) return { text: "Page out of range.", totalPages };

            const page = await pdf.getPage(pageIndex);
            const textContent = await page.getTextContent();
            
            const items = textContent.items as any[];
            
            // Basic sorting to ensure reading order (Top-down, Left-right)
            items.sort((a, b) => {
                const yDiff = b.transform[5] - a.transform[5];
                if (Math.abs(yDiff) > 10) return yDiff; // Different lines
                return a.transform[4] - b.transform[4]; // Same line, sort by X
            });

            let lastY = -9999;
            let text = "";

            for (const item of items) {
                if (lastY !== -9999 && Math.abs(item.transform[5] - lastY) > 10) {
                    text += "\n";
                } else if (text.length > 0 && !text.endsWith("\n") && !text.endsWith(" ")) {
                    text += " ";
                }
                text += item.str;
                lastY = item.transform[5];
            }
            
            return { text, totalPages };

        } catch (e: any) {
            mockService.emitLog("CODEX", "ERROR", `Text Extract Error: ${e.message}`);
            return { text: `Failed to extract text: ${e.message}`, totalPages: 0 };
        }
    }

    public async searchPdf(book: Book, query: string, onProgress?: (matches: ProtocolMatch[]) => void): Promise<ProtocolMatch[]> {
        if (!query || query.trim().length < 2) return [];
        if (book.type !== 'PDF' || !book.pdfAssetId) return [];

        const blob = await bookService.getPdfBlob(book.pdfAssetId);
        if (!blob) {
            mockService.emitLog("CODEX", "WARN", `Blob missing for ${book.title}`);
            return [];
        }

        const arrayBuffer = await blob.arrayBuffer();
        const matches: ProtocolMatch[] = [];
        const searchLower = query.toLowerCase();

        try {
            const loadingTask = getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            const numPages = pdf.numPages;
            
            // mockService.emitLog("CODEX", "INFO", `Scanning ${book.title} (${numPages} pages)...`);

            for (let i = 1; i <= numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                
                // Join with space to ensure words don't merge across chunks
                const rawText = textContent.items.map((item: any) => item.str).join(' ');
                // Normalize whitespace
                const text = rawText.replace(/\s+/g, ' ');
                const textLower = text.toLowerCase();
                
                let startIndex = 0;
                const pageMatches: ProtocolMatch[] = [];
                
                // Loop to find ALL matches on this page
                while (true) {
                    const index = textLower.indexOf(searchLower, startIndex);
                    if (index === -1) break;

                    // Found a match
                    // Extract context (~100 chars before and after)
                    const start = Math.max(0, index - 100);
                    const end = Math.min(text.length, index + searchLower.length + 100);
                    let snippet = text.substring(start, end);
                    
                    snippet = snippet.trim();

                    pageMatches.push({
                        bookId: book.id,
                        bookTitle: book.title,
                        pageIndex: i,
                        context: `...${snippet}...`
                    });

                    // Move search forward
                    startIndex = index + searchLower.length;
                }

                if (pageMatches.length > 0) {
                    matches.push(...pageMatches);
                    if (onProgress) onProgress(pageMatches);
                }
            }

        } catch (e: any) {
            mockService.emitLog("CODEX", "ERROR", `Parse Error in ${book.title}: ${e.message}`);
            // Return empty array so other files can still be searched
            return [];
        }

        return matches;
    }

    public async searchAllLibrary(query: string): Promise<ProtocolMatch[]> {
        // Fallback for non-streaming usage (Assistant view)
        const matches: ProtocolMatch[] = [];
        await this.searchAllLibraryStream(query, (event) => {
            if (event.type === 'MATCHES') {
                matches.push(...event.matches);
            }
        });
        return matches;
    }

    public async searchAllLibraryStream(query: string, callback: (event: SearchEvent) => void): Promise<void> {
        try {
            const library = bookService.getLibrary();
            const pdfs = library.filter(b => b.type === 'PDF');

            if (pdfs.length === 0) {
                callback({ type: 'COMPLETE' });
                return;
            }

            mockService.emitLog("CODEX", "INFO", `Streaming Search: "${query}" in ${pdfs.length} files...`);

            // 1. Check for Title Matches First (Instant feedback)
            const titleMatches: ProtocolMatch[] = [];
            pdfs.forEach(pdf => {
                if (pdf.title.toLowerCase().includes(query.toLowerCase())) {
                    titleMatches.push({
                        bookId: pdf.id,
                        bookTitle: pdf.title,
                        pageIndex: 1,
                        context: "Full Document View"
                    });
                }
            });
            
            if (titleMatches.length > 0) {
                callback({ type: 'MATCHES', matches: titleMatches });
            }

            // 2. Deep Content Search (Concurrency Control: 2 at a time to prevent UI lag)
            const CONCURRENCY_LIMIT = 2;
            const queue = [...pdfs];
            
            const processFile = async (pdf: Book) => {
                callback({ type: 'START_FILE', fileName: pdf.title });
                let fileMatchCount = 0;
                try {
                    // Pass callback to emit matches as they are found per page
                    await this.searchPdf(pdf, query, (newMatches) => {
                        fileMatchCount += newMatches.length;
                        callback({ type: 'MATCHES', matches: newMatches });
                    });
                } catch (e) {
                    // Ignore individual file failures
                }
                callback({ type: 'FILE_COMPLETE', fileName: pdf.title, matchCount: fileMatchCount });
            };

            const workers = Array(Math.min(pdfs.length, CONCURRENCY_LIMIT)).fill(null).map(async () => {
                while (queue.length > 0) {
                    const pdf = queue.shift();
                    if (pdf) await processFile(pdf);
                }
            });

            await Promise.all(workers);
            
            callback({ type: 'COMPLETE' });

        } catch (e: any) {
            mockService.emitLog("CODEX", "ERROR", `Search Stream Failed: ${e.message}`);
            callback({ type: 'COMPLETE' });
        }
    }
}

export const protocolService = new ProtocolService();
