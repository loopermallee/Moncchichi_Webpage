
import { rateLimiter } from './rateLimiter';

const BASE_URL = 'https://api.mangadex.org';
const PROXY_URL = 'https://corsproxy.io/?';

export interface MdChapter {
    id: string;
    volume: string;
    chapter: string;
    title: string;
    pages: number;
}

class MangadexService {
    
    private async fetch(endpoint: string, params: Record<string, string> = {}, signal?: AbortSignal) {
        return rateLimiter.execute('mangadex', async () => {
            const url = new URL(`${BASE_URL}${endpoint}`);
            Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

            const directUrl = url.toString();
            const proxyUrl = `${PROXY_URL}${encodeURIComponent(directUrl)}`;

            const tryFetch = async (u: string, mode: 'DIRECT' | 'PROXY') => {
                try {
                    const res = await fetch(u, { signal });
                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status}`);
                    }
                    return await res.json();
                } catch (error: any) {
                    if (error.name === 'AbortError') {
                        throw error;
                    }
                    console.warn(`[MangaDex] ${mode} Attempt Failed`, {
                        url: u,
                        name: error.name,
                        message: error.message,
                        mode: mode
                    });
                    throw error;
                }
            };

            try {
                return await tryFetch(directUrl, 'DIRECT');
            } catch (directErr: any) {
                if (directErr.name === 'AbortError') throw directErr;
                try {
                    return await tryFetch(proxyUrl, 'PROXY');
                } catch (proxyErr: any) {
                    if (proxyErr.name === 'AbortError') throw proxyErr;
                    console.error("[MangaDex] All fetch attempts failed.");
                    return null;
                }
            }
        });
    }

    public async searchMangaId(title: string, signal?: AbortSignal): Promise<string | null> {
        const data = await this.fetch('/manga', {
            title: title,
            limit: '1',
            'order[relevance]': 'desc'
        }, signal);

        if (data && data.data && data.data.length > 0) {
            return data.data[0].id;
        }
        return null;
    }

    public async getChapters(mangaId: string, signal?: AbortSignal): Promise<MdChapter[]> {
        // Alias to getAllChapters to ensure full list is retrieved
        return this.getAllChapters(mangaId, signal);
    }

    public async getAllChapters(mangaId: string, signal?: AbortSignal): Promise<MdChapter[]> {
        const out: MdChapter[] = [];
        const limit = 100;
        let offset = 0;
        let iterations = 0;

        while (true) {
            iterations++;
            if (iterations > 100) { // Safety cap: 10,000 chapters
                console.warn("[MangaDex] getAllChapters: Safety cap reached. Truncating large result set.");
                break;
            }

            if (signal?.aborted) {
                console.debug("[MangaDex] getAllChapters: Operation aborted.");
                break;
            }

            const data = await this.fetch(`/manga/${mangaId}/feed`, {
                'translatedLanguage[]': 'en',
                'order[chapter]': 'desc',
                limit: String(limit),
                offset: String(offset),
            }, signal);

            if (!data || !data.data || !data.data.length) break;

            out.push(...data.data.map((ch: any) => ({
                id: ch.id,
                volume: ch.attributes.volume,
                chapter: ch.attributes.chapter,
                title: ch.attributes.title || `Chapter ${ch.attributes.chapter}`,
                pages: ch.attributes.pages
            })));

            offset += data.data.length;

            // Stop condition if API provides total
            if (typeof data.total === 'number' && offset >= data.total) break;

            // Safety cap to prevent infinite loops (per-session/per-call)
            if (offset > 5000) break;
        }

        return out;
    }

    public async getPages(chapterId: string, signal?: AbortSignal): Promise<string[]> {
        const data = await this.fetch(`/at-home/server/${chapterId}`, {}, signal);
        
        if (!data || !data.baseUrl) return [];

        const baseUrl = data.baseUrl;
        const hash = data.chapter.hash;
        const files = data.chapter.data; 

        return files.map((file: string) => `${baseUrl}/data/${hash}/${file}`);
    }
}

export const mangadexService = new MangadexService();
