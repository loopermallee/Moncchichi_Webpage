import { getEnv } from './_utils/env.js';

type VercelRequest = { method?: string; body?: unknown; query?: Record<string, string | string[]>; url?: string };
type VercelResponse = { status: (code: number) => { json: (body: any) => void } };

const LTA_BASE_URL = 'https://datamall2.mytransport.sg/ltaodataservice';

function parseBody(req: VercelRequest): any {
    if (req.body === undefined) return undefined;
    if (typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        } catch {
            return undefined;
        }
    }
    return req.body;
}

function parseQuery(req: VercelRequest): URLSearchParams {
    const params = new URLSearchParams();
    if (req.query) {
        for (const [key, value] of Object.entries(req.query)) {
            if (key === 'endpoint') continue;
            if (Array.isArray(value)) {
                value.forEach(v => params.append(key, v));
            } else if (value !== undefined) {
                params.append(key, value);
            }
        }
    } else if (req.url) {
        try {
            const url = new URL(req.url, 'http://localhost');
            url.searchParams.forEach((v, k) => {
                if (k !== 'endpoint') params.append(k, v);
            });
        } catch {
            // ignore
        }
    }
    return params;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const method = req.method || 'GET';
    if (!['GET', 'POST'].includes(method)) {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const apiKey = getEnv('LTA', 'LTA_API_KEY');
    if (!apiKey) {
        res.status(500).json({ error: 'Missing LTA key' });
        return;
    }

    const endpointRaw = req.query?.endpoint;
    const endpoint = typeof endpointRaw === 'string' ? endpointRaw : undefined;
    if (!endpoint) {
        res.status(400).json({ error: 'Missing endpoint' });
        return;
    }

    const baseUrl = endpoint.startsWith('http') ? endpoint : `${LTA_BASE_URL}/${endpoint.replace(/^\//, '')}`;
    const target = new URL(baseUrl);
    const query = parseQuery(req);
    query.forEach((value, key) => target.searchParams.append(key, value));

    const init: RequestInit = {
        method,
        headers: {
            'AccountKey': apiKey,
            'accept': 'application/json'
        }
    };

    const body = parseBody(req);
    if (method === 'POST' && body !== undefined) {
        init.body = typeof body === 'string' ? body : JSON.stringify(body);
        (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
    }

    try {
        const response = await fetch(target.toString(), init);
        const text = await response.text();
        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('application/json') ? JSON.parse(text || '{}') : text;
        res.status(response.status).json(data);
    } catch (error) {
        console.error('Error proxying LTA request', error);
        res.status(500).json({ error: 'Unable to reach LTA service' });
    }
}
