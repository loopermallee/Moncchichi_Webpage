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
2. Set your API keys in [.env.local](.env.local) using the variables from [.env.example](.env.example) (e.g., `VITE_API_KEY`).
3. Run the app:
   `npm run dev`

## Environment Variables

Populate the variables in [.env.example](.env.example) when running locally. Set the same values in your Vercel Environment Variables for both Production and Preview deployments.
