/// <reference types="react/client" />
/// <reference types="react-router-dom/client" />
/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_API_SERVER: string;
  readonly VITE_API_SERVER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
