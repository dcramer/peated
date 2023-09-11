import type { OAuth2Namespace } from "@fastify/oauth2";
import "fastify";
import "vitest";
import type { User } from "./db/schema";

declare namespace NodeJS {
  export interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test";
    PORT?: string;
    HOST?: string;
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
}

declare global {
  export const DefaultFixtures: {
    user: User;
    authHeaders: {
      Authorization: string;
    };
  };
}
