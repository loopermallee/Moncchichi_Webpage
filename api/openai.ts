declare const process: any;

type VercelRequest = { method?: string; body?: unknown };
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
        res.status(405).json({ error: 'Use POST' });
        return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        res.status(500).json({
            error: 'Missing OPENAI_API_KEY',
            hint: 'Set OPENAI_API_KEY in Vercel env vars for this environment and redeploy.',
            vercelEnv: process.env.VERCEL_ENV ?? 'unknown',
            nodeEnv: process.env.NODE_ENV ?? 'unknown'
        });
        return;
    }

    const body = parseBody(req);
    const prompt = typeof body?.prompt === 'string' ? body.prompt : undefined;

    if (!prompt) {
        res.status(400).json({ error: 'Missing prompt' });
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

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            const details = errorText.slice(0, 2000);
            console.error('OpenAI request failed', { status: response.status, details });
            res.status(response.status).json({
                error: 'OpenAI error',
                status: response.status,
                details
            });
            return;
        }

        const data = await response.json().catch(() => ({}));
        const text = extractText(data);
        res.status(200).json({ text });
    } catch (error) {
        console.error('Error reaching OpenAI', error);
        res.status(500).json({ error: 'Unable to reach OpenAI' });
    }
}
