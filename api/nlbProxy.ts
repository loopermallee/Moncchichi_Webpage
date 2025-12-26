import { getEnv } from './_utils/env';

type VercelRequest = { method?: string; query?: Record<string, string | string[]>; url?: string };
type VercelResponse = { status: (code: number) => { json: (body: any) => void } };

const ALLOWED_HOSTS = ['openweb-api.nlb.gov.sg', 'openweb.nlb.gov.sg'];

function getTargetUrl(req: VercelRequest): string | undefined {
    const raw = req.query?.target;
    if (typeof raw === 'string') return raw;
    if (req.url) {
        try {
            const url = new URL(req.url, 'http://localhost');
            const target = url.searchParams.get('target');
            return target || undefined;
        } catch {
            return undefined;
        }
    }
    return undefined;
}

function isAllowed(urlStr: string): boolean {
    try {
        const url = new URL(urlStr);
        return ALLOWED_HOSTS.includes(url.hostname);
    } catch {
        return false;
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method && req.method !== 'GET') {
        res.status(405).json({ error: 'Only GET supported' });
        return;
    }

    const apiKey = getEnv('NLB', 'NLB_API_KEY');
    const appCode = getEnv('NLB_APP', 'NLB_APP_CODE', 'NLB_APPID');
    if (!apiKey || !appCode) {
        res.status(500).json({ error: 'Missing NLB credentials' });
        return;
    }

    const target = getTargetUrl(req);
    if (!target || !isAllowed(target)) {
        res.status(400).json({ error: 'Invalid target' });
        return;
    }

    try {
        const response = await fetch(target, {
            headers: {
                'X-App-Code': appCode,
                'X-API-Key': apiKey,
                'accept': 'application/json'
            }
        });

        const text = await response.text();
        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('application/json') ? JSON.parse(text || '{}') : text;
        res.status(response.status).json(data);
    } catch (error) {
        console.error('Error proxying NLB request', error);
        res.status(500).json({ error: 'Unable to reach NLB service' });
    }
}
