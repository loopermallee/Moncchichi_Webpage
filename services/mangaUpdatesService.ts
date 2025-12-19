
const MU_API = 'https://api.mangaupdates.com/v1';
const PROXY_URL = 'https://corsproxy.io/?';

export interface MuSeries {
    series_id: number;
    title: string;
    description: string;
    genres: { genre: string }[];
    categories: { series_id: number, category: string, votes: number }[];
    associated: { title: string }[];
}

class MangaUpdatesService {
    
    private async fetch(endpoint: string, method: 'GET'|'POST', body?: any) {
        try {
            const url = `${PROXY_URL}${encodeURIComponent(`${MU_API}${endpoint}`)}`;
            const opts: RequestInit = {
                method,
                headers: { 'Content-Type': 'application/json' }
            };
            if (body) opts.body = JSON.stringify(body);

            const res = await fetch(url, opts);
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            return null;
        }
    }

    public async searchSeries(title: string): Promise<MuSeries | null> {
        // Search
        const searchRes = await this.fetch('/series/search', 'POST', {
            search: title,
            perpage: 1
        });

        if (searchRes && searchRes.results && searchRes.results.length > 0) {
            const id = searchRes.results[0].record.series_id;
            // Get Details
            return await this.fetch(`/series/${id}`, 'GET');
        }
        return null;
    }
}

export const mangaUpdatesService = new MangaUpdatesService();
