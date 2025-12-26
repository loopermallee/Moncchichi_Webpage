import type { VercelRequest, VercelResponse } from '@vercel/node';

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

function extractText(data: any): string {
    if (typeof data?.output_text === 'string') return data.output_text;

    if (Array.isArray(data?.output)) {
        for (const item of data.output) {
            if (typeof item?.text === 'string') return item.text;
            if (Array.isArray(item?.content)) {
                const textPart = item.content.find((part: any) => typeof part?.text === 'string');
                if (textPart?.text) return textPart.text;
                if (typeof item.content === 'string') return item.content;
            }
        }
    }

    if (Array.isArray(data?.choices)) {
        const choice = data.choices[0];
        if (typeof choice?.message?.content === 'string') return choice.message.content;
    }

    return '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: 'Server configuration error' });
        return;
    }

    const body = parseBody(req);
    const prompt = typeof body?.prompt === 'string' ? body.prompt : undefined;

    if (!prompt) {
        res.status(400).json({ error: 'Prompt is required' });
        return;
    }

    try {
        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({ model: 'gpt-4o-mini', input: prompt, temperature: 0.7 })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const message = typeof data?.error?.message === 'string' ? data.error.message : 'OpenAI request failed';
            res.status(response.status).json({ error: message });
            return;
        }

        const text = extractText(data);
        res.status(200).json({ text });
    } catch (error) {
        res.status(500).json({ error: 'Unable to reach OpenAI' });
    }
}
