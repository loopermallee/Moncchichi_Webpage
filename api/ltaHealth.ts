import { getEnv } from './_utils/env.js';

type VercelResponse = { status: (code: number) => { json: (body: any) => void } };

type VercelRequest = { method?: string };

export default function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method && req.method !== 'GET') {
        res.status(405).json({ ok: false, reason: 'Method not allowed' });
        return;
    }

    const apiKey = getEnv('LTA', 'LTA_API_KEY');
    if (!apiKey) {
        res.status(200).json({ ok: false, reason: 'Missing LTA key' });
        return;
    }

    res.status(200).json({ ok: true });
}
