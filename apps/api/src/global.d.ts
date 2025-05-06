import type MockAdapter from "axios-mock-adapter";
import "vitest";
import type { User } from "./db/schema";
import type * as fixtures from "./lib/test/fixtures";

declare module "hono" {
  interface Env {
    Variables: {
      user: User | null;
    };
  }
}

declare namespace NodeJS {
  export interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test";
    PORT?: string;
    HOST?: string;
    DISABLE_HTTP_CACHE?: string;
    API_SERVER?: string;
    API_KEY?: string;
  }
}

interface CustomMatchers<R = unknown> {
  toRespondWith(statusCode: number): R;
}

declare module "vitest" {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}

  export interface TestContext {
    axiosMock: ReturnValue<typeof MockAdapter>;

    defaults: {
      user: User;
      authHeaders: {
        Authorization: string;
      };
    };

    fixtures: typeof fixtures;
  }
}
