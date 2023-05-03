import { fastify } from "fastify";
import FastifyCors from "@fastify/cors";
import FastifyHelmet from "@fastify/helmet";
import FastifyMultipart from "@fastify/multipart";

import { router } from "./routes";
import config from "./config";

const envToLogger: {
  [env: string]: any;
} = {
  development: {
    level: "info",
    transport: {
      target: "@fastify/one-line-logger",
    },
  },
  production: {
    level: "warn",
  },
  test: {
    level: "error",
    transport: {
      target: "@fastify/one-line-logger",
    },
  },
};

export default async function buildFastify(options = {}) {
  const app = fastify({
    logger: envToLogger[config.ENV] ?? true,
    ...options,
  });

  app.register(FastifyMultipart);
  app.register(FastifyHelmet);
  app.register(FastifyCors, { credentials: true, origin: config.CORS_HOST });
  app.register(router);

  return app;
}
