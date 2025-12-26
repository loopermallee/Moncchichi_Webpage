const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';

type FetchOptions = {
    query?: Record<string, string | number | undefined>;
    method?: 'GET' | 'POST';
    body?: unknown;
};

async function parseJson(res: Response) {
    const text = await res.text();
    try {
        return text ? JSON.parse(text) : {};
    } catch {
        return {};
    }
}

export async function callOpenAI(prompt: string, options?: { model?: string; temperature?: number; systemInstruction?: string }) {
    const res = await fetch('/api/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...options })
    });
    if (!res.ok) throw new Error('OpenAI request failed');
    return parseJson(res);
}

export async function callGemini(prompt: string, options?: { model?: string; temperature?: number; systemInstruction?: string }) {
    const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...options })
    });
    if (!res.ok) throw new Error('Gemini request failed');
    return parseJson(res);
}

export async function fetchLTA(endpoint: string, options: FetchOptions = {}) {
    const url = new URL('/api/ltaProxy', origin);
    url.searchParams.set('endpoint', endpoint);
    if (options.query) {
        Object.entries(options.query).forEach(([key, value]) => {
            if (value !== undefined) url.searchParams.append(key, String(value));
        });
    }

    const method = options.method || 'GET';
    const res = await fetch(url.toString(), {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify(options.body)
    });

    const data = await parseJson(res);
    if (!res.ok) {
        const message = (data as any)?.error || `LTA request failed (${res.status})`;
        throw new Error(message);
    }
    return data;
}

export async function fetchNLB(targetUrl: string) {
    const proxyUrl = new URL('/api/nlbProxy', origin);
    proxyUrl.searchParams.set('target', targetUrl);

    const res = await fetch(proxyUrl.toString());
    const data = await parseJson(res);
    if (!res.ok) {
        const message = (data as any)?.error || `NLB request failed (${res.status})`;
        throw new Error(message);
    }
    return data;
}
