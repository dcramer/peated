/// <reference types="@remix-run/dev" />
/// <reference types="@remix-run/express" />

import type { AppRouter } from "@peated/server/trpc/router";
import type { User } from "@peated/server/types";
import "@remix-run/server-runtime";
import type { CreateTRPCProxyClient } from "@trpc/client";
import "express-serve-static-core";
import type { ApiClient } from "~/lib/api";

interface Context {
  user: User | null;
  accessToken: string | null;
  api: ApiClient;
  trpc: CreateTRPCProxyClient<AppRouter>;
}

declare module "@express-serve-static-core" {
  export interface Request extends Context {}
}

// XXX: this is still not working correctly
declare module "@remix-run/server-runtime" {
  export interface AppLoadContext extends Context {}
}

interface Config {
  GOOGLE_CLIENT_ID?: string;
  DEBUG?: string;
  API_SERVER?: string;
  SENTRY_DSN?: string;
  VERSION?: string;
  NODE_ENV: "development" | "production";
  PORT?: string;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends Config {
      SECRET?: string;
    }
  }

  interface Window {
    CONFIG: Config;
  }
}
