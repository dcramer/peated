import { OAuth2Namespace } from "@fastify/oauth2";
import "fastify";
import { User } from "./db/schema";

declare namespace NodeJS {
  export interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test";
    PORT?: string;
    HOST?: string;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    googleOAuth2: OAuth2Namespace;
  }
  export interface FastifyRequest {
    user: any;
  }
}

interface CustomMatchers<R = unknown> {
  toRespondWith(statusCode: number): R;
}

declare global {
  namespace Vi {
    type Assertion = CustomMatchers;
    type AsymmetricMatchersContaining = CustomMatchers;
  }

  const DefaultFixtures = {
    user: User,
    authHeaders: {
      Authorization: string,
    },
  };
}
