import { fastify } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";

import { router } from "./routes";
import config from "./config";

const envToLogger: {
  [env: string]: any;
} = {
  development: {
    level: "info",
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname,reqId",
      },
    },
  },
  production: {
    level: "warn",
  },
  test: false,
};

export default async function buildFastify(options = {}) {
  const app = fastify({
    logger: envToLogger[config.ENV] ?? true,
    ...options,
  });

  app.register(helmet);
  app.register(cors, { credentials: true, origin: config.CORS_HOST });
  app.register(router);

  return app;
}
