/// <reference types="react/client" />
/// <reference types="react-router-dom/client" />
/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/info" />

interface ImportMetaEnv {
  readonly GOOGLE_CLIENT_ID: string;
  readonly SENTRY_DSN: string;
  readonly API_SERVER: string;
  readonly VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace NodeJS {
  export interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test";
    SENTRY_DSN?: string;
    API_SERVER?: string;
    VERSION?: string;
  }
}
