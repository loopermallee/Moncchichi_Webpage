
import { mockService } from './mockService';

const BASE_URL = 'https://api.consumet.org/books/libgen';
const PROXY_URL = 'https://corsproxy.io/?';

export interface LibgenBook {
    id: string;
    title: string;
    author: string;
    publisher: string;
    year: string;
    language: string;
    extension: string;
    fileSize: string;
}

class LibgenService {
    
    private async fetch(endpoint: string, params: Record<string, string> = {}) {
        try {
            const url = new URL(`${BASE_URL}${endpoint}`);
            Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
            
            // Consumet often needs a proxy from browser due to CORS
            const targetUrl = `${PROXY_URL}${encodeURIComponent(url.toString())}`;
            const res = await fetch(targetUrl);
            
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.warn("LibGen API Error", e);
            return null;
        }
    }

    public async search(query: string): Promise<LibgenBook[]> {
        // "bookTitle must be at least 4 characters long" per documentation
        if (query.length < 4) return [];

        const data = await this.fetch('/s', {
            bookTitle: query,
            page: '1'
        });

        if (data && Array.isArray(data.results)) {
            return data.results;
        }
        return [];
    }
}

export const libgenService = new LibgenService();
