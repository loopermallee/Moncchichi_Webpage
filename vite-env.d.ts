/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NEA_API_KEY: string | undefined;
  readonly VITE_GOOGLE_MAPS: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
