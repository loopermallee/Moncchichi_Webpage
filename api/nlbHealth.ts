import { getEnv } from './_utils/env.js';

type VercelResponse = { status: (code: number) => { json: (body: any) => void } };

type VercelRequest = { method?: string };

export default function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method && req.method !== 'GET') {
        res.status(405).json({ ok: false, reason: 'Method not allowed' });
        return;
    }

    const apiKey = getEnv('NLB', 'NLB_API_KEY');
    const appCode = getEnv('NLB_APP', 'NLB_APP_CODE', 'NLB_APPID');
    if (!apiKey || !appCode) {
        res.status(200).json({ ok: false, reason: 'Missing NLB credentials' });
        return;
    }

    res.status(200).json({ ok: true });
}
