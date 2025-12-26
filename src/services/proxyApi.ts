const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';

export type ProxyError = Error & {
    status?: number;
    bodyText?: string;
    source?: 'proxy' | 'manual';
};

type FetchOptions = {
    query?: Record<string, string | number | undefined>;
    method?: 'GET' | 'POST';
    body?: unknown;
};

async function parseJson(res: Response) {
    const text = await res.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

function buildError(message: string, status?: number, bodyText?: string, source: 'proxy' | 'manual' = 'proxy'): ProxyError {
    const err = new Error(message) as ProxyError;
    err.status = status;
    err.bodyText = bodyText;
    err.source = source;
    return err;
}

async function handleResponse(res: Response, label: string, source: 'proxy' | 'manual' = 'proxy'): Promise<any> {
    const data = await parseJson(res);
    if (!res.ok) {
        const text = typeof data === 'string' ? data : (data as any)?.error || JSON.stringify(data);
        throw buildError(`${label} failed (${res.status})`, res.status, text, source);
    }
    return data;
}

function appendQuery(url: URL, query?: Record<string, string | number | undefined>) {
    if (!query) return;
    Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) url.searchParams.append(key, String(value));
    });
}

export async function callOpenAI(prompt: string, options?: { model?: string; temperature?: number; systemInstruction?: string }) {
    const res = await fetch('/api/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...options })
    });
    return handleResponse(res, 'OpenAI');
}

export async function callGemini(prompt: string, options?: { model?: string; temperature?: number; systemInstruction?: string }) {
    const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...options })
    });
    return handleResponse(res, 'Gemini');
}

export async function fetchLTA(endpoint: string, options: FetchOptions = {}, manualKey?: string) {
    const url = new URL('/api/lta', origin);
    url.searchParams.set('endpoint', endpoint);
    appendQuery(url, options.query);

    const method = options.method || 'GET';
    const proxyRes = await fetch(url.toString(), {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify(options.body)
    });

    try {
        return await handleResponse(proxyRes, 'LTA');
    } catch (proxyError) {
        if (manualKey) {
            const directUrl = new URL(`https://datamall2.mytransport.sg/ltaodataservice/${endpoint.replace(/^\//, '')}`);
            appendQuery(directUrl, options.query);
            const directRes = await fetch(directUrl.toString(), {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'AccountKey': manualKey,
                    'accept': 'application/json'
                },
                body: method === 'GET' ? undefined : JSON.stringify(options.body)
            });
            return handleResponse(directRes, 'LTA (manual key)', 'manual');
        }
        throw proxyError;
    }
}

export async function fetchNLB(targetUrl: string, manualKey?: { apiKey?: string; appCode?: string }) {
    const proxyUrl = new URL('/api/nlb', origin);
    proxyUrl.searchParams.set('target', targetUrl);

    const proxyRes = await fetch(proxyUrl.toString());
    try {
        return await handleResponse(proxyRes, 'NLB');
    } catch (proxyError) {
        if (manualKey?.apiKey && manualKey?.appCode) {
            const directRes = await fetch(targetUrl, {
                headers: {
                    'X-App-Code': manualKey.appCode,
                    'X-API-Key': manualKey.apiKey,
                    'accept': 'application/json'
                }
            });
            return handleResponse(directRes, 'NLB (manual key)', 'manual');
        }
        throw proxyError;
    }
}

export async function fetchHealth(path: string) {
    const res = await fetch(path);
    return handleResponse(res, 'Health');
}
