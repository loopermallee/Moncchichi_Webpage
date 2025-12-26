/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_KEY: string | undefined;
  readonly VITE_OPENAI_API_KEY: string | undefined;
  readonly VITE_LTA_API_KEY: string | undefined;
  readonly VITE_NLB_API_KEY: string | undefined;
  readonly VITE_NLB_APP: string | undefined;
  readonly VITE_NEA_API_KEY: string | undefined;
  readonly VITE_GOOGLE_MAPS: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
