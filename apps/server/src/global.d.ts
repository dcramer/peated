import type { OAuth2Namespace } from "@fastify/oauth2";
import type MockAdapter from "axios-mock-adapter";
import "fastify";
import "vitest";
import type { User } from "./db/schema";
import type * as fixtures from "./lib/test/fixtures";

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

declare module "fastify" {
  export interface FastifyInstance {
    googleOAuth2: OAuth2Namespace;
  }
  export interface FastifyRequest {
    user: User | null;
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
