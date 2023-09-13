import * as Sentry from "@sentry/node-experimental";
import fastifyPlugin from "fastify-plugin";

export interface SentryContext {
  transaction: any;
}

declare module "fastify" {
  interface FastifyRequest {
    _sentryContext: SentryContext;
  }
}

export default fastifyPlugin(async (fastify, options) => {
  fastify.decorateRequest("_sentryContext", null);

  fastify.addHook("onError", async (_request, _reply, error) => {
    Sentry.captureException(error);
  });
});
