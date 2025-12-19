

export type ApiId = 'GEMINI' | 'OPENAI' | 'LTA' | 'NLB' | 'NLB_APP' | 'NEA' | 'GOOGLE_MAPS' | 'FINNHUB' | 'ALPHAVANTAGE';

class KeyService {
    private keys: Record<ApiId, string> = {
        GEMINI: '',
        OPENAI: '',
        LTA: '',
        NLB: '',
        NLB_APP: '',
        NEA: '',
        GOOGLE_MAPS: '',
        FINNHUB: '',
        ALPHAVANTAGE: ''
    };

    constructor() {
        this.loadKeys();
    }

    private loadKeys() {
        // 1. Load from LocalStorage
        try {
            const stored = localStorage.getItem('moncchichi_keys');
            if (stored) {
                const parsed = JSON.parse(stored);
                // Merge loaded keys into defaults to preserve hardcoded fallbacks if user hasn't overridden them
                this.keys = { ...this.keys, ...parsed };
            }
        } catch (e) {
            console.warn("Failed to load keys from storage");
        }

        // 2. Fallback to Environment Variables (if not set in storage/defaults)
        if (!this.keys.GEMINI) this.keys.GEMINI = (process as any).env?.API_KEY || '';
        if (!this.keys.OPENAI) this.keys.OPENAI = (process as any).env?.OPENAI_API_KEY || '';
        if (!this.keys.LTA) this.keys.LTA = (process as any).env?.LTA_API_KEY || '';
        if (!this.keys.NLB) this.keys.NLB = (process as any).env?.NLB_API_KEY || '';
    }

    public get(id: ApiId): string {
        return this.keys[id] || '';
    }

    public set(id: ApiId, value: string) {
        this.keys[id] = value.trim();
        this.save();
    }

    private save() {
        localStorage.setItem('moncchichi_keys', JSON.stringify(this.keys));
    }
    
    public hasKey(id: ApiId): boolean {
        return !!this.get(id);
    }
}

export const keyService = new KeyService();