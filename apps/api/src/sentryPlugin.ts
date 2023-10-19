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

  fastify.addHook("preHandler", async (request) => {
    Sentry.configureScope((scope) =>
      scope.addEventProcessor((event) => {
        try {
          event.request = {
            method: request.method,
            url: request.url,
            // headers: request.headers,
            query_string: request.query as Record<string, any>,
          };
        } catch (err) {
          console.error(err);
        }

        return event;
      }),
    );
  });

  fastify.addHook("onError", async (_request, _reply, error) => {
    Sentry.captureException(error);
  });
});
