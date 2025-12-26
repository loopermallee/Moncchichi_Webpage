type VercelResponse = { status: (code: number) => { json: (body: any) => void } };

export default function handler(_req: unknown, res: VercelResponse) {
    res.status(200).json({ ok: true, ts: Date.now() });
}
