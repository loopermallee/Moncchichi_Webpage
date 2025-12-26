declare const process: any;

import { getEnv } from './_utils/env';

type VercelRequest = { method?: string; body?: unknown } & { query?: Record<string, string | string[]>; url?: string };
type VercelResponse = { status: (code: number) => { json: (body: any) => void } };

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Use POST' });
        return;
    }

    const apiKey = getEnv('GEMINI', 'GEMINI_API_KEY');
    if (!apiKey) {
        res.status(500).json({
            error: 'Missing GEMINI key',
            hint: 'Set GEMINI or GEMINI_API_KEY in server env vars.',
            vercelEnv: process.env.VERCEL_ENV ?? 'unknown',
            nodeEnv: process.env.NODE_ENV ?? 'unknown'
        });
        return;
    }

    const body = parseBody(req);
    const prompt = typeof body?.prompt === 'string' ? body.prompt : undefined;
    const model = typeof body?.model === 'string' ? body.model : 'gemini-1.5-flash';
    const temperature = typeof body?.temperature === 'number' ? body.temperature : 0.7;
    const systemInstruction = typeof body?.systemInstruction === 'string' ? body.systemInstruction : undefined;

    if (!prompt) {
        res.status(400).json({ error: 'Missing prompt' });
        return;
    }

    const contents: any[] = [{ role: 'user', parts: [{ text: prompt }] }];

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents,
                systemInstruction: systemInstruction ? { role: 'system', parts: [{ text: systemInstruction }] } : undefined,
                generationConfig: { temperature }
            })
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            const details = errorText.slice(0, 2000);
            console.error('Gemini request failed', { status: response.status, details });
            res.status(response.status).json({
                error: 'Gemini error',
                status: response.status,
                details
            });
            return;
        }

        const data = await response.json().catch(() => ({}));
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        res.status(200).json({ text });
    } catch (error) {
        console.error('Error reaching Gemini', error);
        res.status(500).json({ error: 'Unable to reach Gemini' });
    }
}
