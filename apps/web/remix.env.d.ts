/// <reference types="@remix-run/dev" />
/// <reference types="@remix-run/node" />

import "express-serve-static-core";
import type { ApiClient } from "~/lib/api";
import type { User } from "~/types";

declare global {
  interface Window {
    CONFIG: Record<string, any>;
  }
}

interface Context {
  user: User | null;
  accessToken: string | null;
  api: ApiClient;
}

declare global {
  namespace Express {
    interface Request extends Context {}
  }
}

module "@remix-run/server-runtime" {
  interface AppLoadContext extends Context {}
}
