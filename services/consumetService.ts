
export interface ConsumetSearchResult {
    id: string;
    title: string;
    altTitles?: string[];
    description?: string;
    image?: string;
    status?: string;
    releaseDate?: number;
    contentRating?: string;
}

export interface ConsumetMangaInfo {
    id: string;
    title: string;
    altTitles?: string[];
    description?: string;
    genres?: string[];
    themes?: string[];
    status?: string;
    releaseDate?: number;
    chapters: ConsumetChapter[];
}

export interface ConsumetChapter {
    id: string;
    title: string;
    chapterNumber?: string;
    volumeNumber?: string;
    pages?: number;
}

export interface ConsumetPage {
    img: string;
    page: number;
    headerForImage?: Record<string, string>;
}

export type ConsumetProvider = 'mangadex' | 'mangahere' | 'mangapill' | 'mangareader';

interface CacheEntry {
    data: any;
    expires: number;
}

class ConsumetService {
    private baseUrl = 'https://api.consumet.org';
    private cache = new Map<string, CacheEntry>();
    private cacheTTL = 5 * 60 * 1000; // 5 minutes
    private requestQueue = new Map<string, Promise<any>>();

    private async fetchWithValidation<T>(url: string): Promise<T | null> {
        const cached = this.cache.get(url);
        if (cached && Date.now() < cached.expires) {
            return cached.data;
        }

        if (this.requestQueue.has(url)) {
            return this.requestQueue.get(url);
        }

        const requestPromise = (async () => {
            try {
                const res = await fetch(url);
                if (!res.ok) return null;

                const contentType = res.headers.get('content-type');
                if (!contentType?.includes('application/json')) return null;

                const data = await res.json();
                this.cache.set(url, { data, expires: Date.now() + this.cacheTTL });
                return data;
            } catch (e: any) {
                return null;
            } finally {
                this.requestQueue.delete(url);
            }
        })();

        this.requestQueue.set(url, requestPromise);
        return requestPromise;
    }

    public async searchManga(
        query: string,
        provider: ConsumetProvider = 'mangadex',
        page = 1
    ): Promise<ConsumetSearchResult[]> {
        if (!query.trim()) return [];
        const url = `${this.baseUrl}/manga/${provider}/${encodeURIComponent(query)}?page=${page}`;
        const data = await this.fetchWithValidation<{ results: ConsumetSearchResult[] }>(url);
        return data?.results || [];
    }

    public async getMangaInfo(mangaId: string, provider: ConsumetProvider): Promise<ConsumetMangaInfo | null> {
        const url = `${this.baseUrl}/manga/${provider}/info/${mangaId}`;
        return await this.fetchWithValidation<ConsumetMangaInfo>(url);
    }

    public async getChapterPages(chapterId: string, provider: ConsumetProvider): Promise<string[]> {
        const url = `${this.baseUrl}/manga/${provider}/read/${chapterId}`;
        const data = await this.fetchWithValidation<ConsumetPage[]>(url);
        if (!data || !Array.isArray(data)) return [];
        return data
            .sort((a, b) => a.page - b.page)
            .map(p => p.img)
            .filter(img => !!img);
    }

    public clearCache(): void {
        this.cache.clear();
    }
}

export const consumetService = new ConsumetService();
