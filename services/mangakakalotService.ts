
const PROXY_URL = 'https://corsproxy.io/?';
const BASE_URL = 'https://mangakakalot.com';
const MANGINELO_URL = 'https://manganato.com'; // Mangakakalot often redirects here

export interface MkChapter {
    id: string; // Full URL
    title: string;
    chapterStr: string;
}

class MangakakalotService {
    
    private async fetchHtml(url: string): Promise<Document | null> {
        try {
            const target = `${PROXY_URL}${encodeURIComponent(url)}`;
            const res = await fetch(target);
            if (!res.ok) return null;
            const text = await res.text();
            const parser = new DOMParser();
            return parser.parseFromString(text, 'text/html');
        } catch (e) {
            console.warn("Mangakakalot Fetch Error", e);
            return null;
        }
    }

    public async search(query: string): Promise<any[]> {
        const cleanQuery = query.trim().replace(/\s+/g, '_').toLowerCase();
        const url = `${BASE_URL}/search/story/${cleanQuery}`;
        const doc = await this.fetchHtml(url);
        
        if (!doc) return [];

        const results: any[] = [];
        const items = doc.querySelectorAll('.story_item');

        items.forEach((item) => {
            try {
                const linkTag = item.querySelector('a');
                const imgTag = item.querySelector('img');
                const titleTag = item.querySelector('.story_name a');
                // const authorTag = item.querySelector('.story_author'); // Often text-only

                if (linkTag && imgTag && titleTag) {
                    const href = linkTag.getAttribute('href');
                    const cover = imgTag.getAttribute('src');
                    const title = titleTag.textContent || "Unknown";
                    
                    if (href) {
                        results.push({
                            id: href, // Mangakakalot uses full URLs as IDs often
                            title: title,
                            cover: cover,
                            author: "Mangakakalot", // Hard to parse cleanly from list
                            status: "Unknown"
                        });
                    }
                }
            } catch (e) {}
        });

        return results;
    }

    public async getPopular(): Promise<any[]> {
        const url = `${MANGINELO_URL}/genre-all?type=topview`;
        const doc = await this.fetchHtml(url);
        
        if (!doc) return [];

        const results: any[] = [];
        const items = doc.querySelectorAll('.content-genres-item');

        items.forEach((item) => {
            try {
                const linkTag = item.querySelector('.genres-item-name');
                const imgTag = item.querySelector('img');
                const authorTag = item.querySelector('.genres-item-author');

                if (linkTag && imgTag) {
                    const href = linkTag.getAttribute('href');
                    const title = linkTag.textContent || "Unknown";
                    const cover = imgTag.getAttribute('src');
                    const author = authorTag ? authorTag.textContent : "Unknown Author";

                    if (href) {
                        results.push({
                            id: href,
                            title: title,
                            cover: cover,
                            author: author,
                            status: "Popular"
                        });
                    }
                }
            } catch (e) {
                // Skip item on error
            }
        });

        return results.slice(0, 15);
    }

    public async getChapters(mangaUrl: string): Promise<MkChapter[]> {
        const doc = await this.fetchHtml(mangaUrl);
        if (!doc) return [];

        const chapters: MkChapter[] = [];
        // Selector for Mangakakalot / Manganato chapter list
        const rows = doc.querySelectorAll('.chapter-list .row, .row-content-chapter li');

        rows.forEach((row) => {
            const link = row.querySelector('a');
            if (link) {
                const href = link.getAttribute('href');
                const title = link.textContent || "";
                
                // Extract chapter number for sorting
                // "Chapter 10: Title" -> "10"
                const match = title.match(/Chapter\s+([0-9.]+)/i);
                const chapNum = match ? match[1] : "0";

                if (href) {
                    chapters.push({
                        id: href,
                        title: title,
                        chapterStr: chapNum
                    });
                }
            }
        });

        return chapters;
    }

    public async getPages(chapterUrl: string): Promise<string[]> {
        const doc = await this.fetchHtml(chapterUrl);
        if (!doc) return [];

        const pages: string[] = [];
        // Container often div.container-chapter-reader
        const images = doc.querySelectorAll('.container-chapter-reader img');

        images.forEach((img) => {
            const src = img.getAttribute('src');
            if (src) pages.push(src);
        });

        return pages;
    }
}

export const mangakakalotService = new MangakakalotService();
