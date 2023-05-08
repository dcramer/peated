import { fastify } from "fastify";
import FastifyCors from "@fastify/cors";
import FastifyHelmet from "@fastify/helmet";
import FastifyMultipart from "@fastify/multipart";

import { router } from "./routes";
import config from "./config";

import FastifySentry from "./sentryPlugin";
import { initSentry } from "./instruments";

initSentry({
  dsn: config.SENTRY_DSN,
  release: config.VERSION,
});

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
  app.register(FastifySentry);

  app.setErrorHandler(function (error, request, reply) {
    if (error instanceof fastify.errorCodes.FST_ERR_BAD_STATUS_CODE) {
      // Log error
      this.log.error(error);
      // Send error response
      reply.status(500).send({
        ok: false,
        stack: config.ENV !== "production" ? error.stack : undefined,
      });
    } else {
      console.error(error);
      // fastify will use parent error handler to handle this
      reply.status(error.statusCode || 500).send({
        ok: false,
        error: "Internal Server Error",
        stack: config.ENV !== "production" ? error.stack : undefined,
      });
    }
  });

  return app;
}
