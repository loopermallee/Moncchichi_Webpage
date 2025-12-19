import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
// Import process to fix 'cwd' property error
import process from 'node:process';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY),
      'process.env.LTA_API_KEY': JSON.stringify(env.LTA_API_KEY),
      'process.env.NLB_API_KEY': JSON.stringify(env.NLB_API_KEY),
      'process.env.NLB_APP': JSON.stringify(env.NLB_APP),
      'process.env.NEA_API_KEY': JSON.stringify(env.NEA_API_KEY),
      'process.env.GOOGLE_MAPS': JSON.stringify(env.GOOGLE_MAPS),
    },
    build: {
      outDir: 'dist',
      sourcemap: false
    }
  }
})