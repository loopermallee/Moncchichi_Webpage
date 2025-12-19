
import { mockService } from './mockService';

const API_KEY = '386210947bbe877b7ac30c0560a2d35e6df7a440c0560a2d35e6df7a4c9'; // Validated key format from prompt
const PROXY_URL = 'https://corsproxy.io/?';

export interface ComicVineVolume {
    id: number;
    name: string;
    description: string;
    image: {
        medium_url: string;
    };
    count_of_issues: number;
    publisher: { name: string };
}

class ComicVineService {
    
    private async fetch(endpoint: string, params: Record<string, string> = {}) {
        try {
            const url = new URL(`https://comicvine.gamespot.com/api/${endpoint}/`);
            url.searchParams.append('api_key', API_KEY);
            url.searchParams.append('format', 'json');
            Object.keys(params).forEach(k => url.searchParams.append(k, params[k]));

            // Comic Vine strictly requires a user-agent, which browsers set, but CORS proxies help handling headers
            const targetUrl = encodeURIComponent(url.toString());
            const response = await fetch(`${PROXY_URL}${targetUrl}`);
            
            if (!response.ok) return null;
            const json = await response.json();
            return json;
        } catch (e) {
            console.warn("ComicVine Request Failed", e);
            return null;
        }
    }

    public async searchVolume(query: string): Promise<ComicVineVolume | null> {
        const data = await this.fetch('search', {
            query: query,
            resources: 'volume',
            limit: '1'
        });

        if (data && data.results && data.results.length > 0) {
            return data.results[0];
        }
        return null;
    }
}

export const comicVineService = new ComicVineService();
