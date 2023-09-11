declare namespace NodeJS {
  export interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test";
    DISABLE_HTTP_CACHE?: string;
    API_SERVER?: string;
    API_KEY?: string;
  }
}
