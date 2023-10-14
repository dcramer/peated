declare namespace NodeJS {
  export interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test";
    DISABLE_HTTP_CACHE?: string;
    API_SERVER?: string;
    API_KEY?: string;
  }
}

declare module "faktory-worker/lib/faktory" {
  export declare type JobFunctionContextWrapper = {
    (...args: any[]): ContextProvider;
  };
  export declare type UnWrappedJobFunction = {
    (...args: any[]): unknown;
  };
  export declare type JobFunction =
    | JobFunctionContextWrapper
    | UnWrappedJobFunction;
}
