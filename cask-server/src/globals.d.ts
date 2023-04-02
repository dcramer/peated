import fastify from "fastify";

declare namespace NodeJS {
  export interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test";
    PORT?: string;
    HOST?: string;
  }
}

declare module "fastify" {
  export interface FastifyRequest {
    user: any;
  }
}
