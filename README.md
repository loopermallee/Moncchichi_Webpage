<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/16PXyCvDZ4NAV3FmXXPjjTbTiXrl1xWLw

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set your API keys in [.env.local](.env.local) using the variables from [.env.example](.env.example).
3. Run the app:
   `npm run dev`

## Environment Variables

Populate the variables in [.env.example](.env.example) when running locally. Set the same values in your Vercel Environment Variables for both Production and Preview deployments.

### Server-only

- `OPENAI` or `OPENAI_API_KEY` (used by `/api/openai` – do **not** prefix with `VITE_`)
- `GEMINI` or `GEMINI_API_KEY` (used by `/api/gemini`)
- `LTA` or `LTA_API_KEY` (used by `/api/ltaProxy`)
- `NLB`/`NLB_API_KEY` and `NLB_APP`/`NLB_APP_CODE`/`NLB_APPID` (used by `/api/nlbProxy`)

### Public/client

- `VITE_GOOGLE_MAPS` (non-secret client key)
- `VITE_NEA_API_KEY` (optional)

## API Routes

These serverless functions run on Vercel:

- `GET /api/health` – simple health check returning `{ ok: true, ts: <timestamp> }`.
- `POST /api/openai` – proxies OpenAI text generation using server-side secrets. Send `{ "prompt": "..." }` and receive `{ "text": "..." }`.
- `POST /api/gemini` – proxies Gemini text generation with server-side secrets.
- `GET /api/ltaProxy` – proxies Land Transport Authority DataMall requests; provide `endpoint` and query params.
- `GET /api/nlbProxy` – proxies National Library Board requests when given a trusted `target` URL.

> Keep your AI and transport keys on the server. Do **not** expose them via `VITE_*` environment variables.
