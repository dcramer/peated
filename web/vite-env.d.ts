/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_SENTRY_DSN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
