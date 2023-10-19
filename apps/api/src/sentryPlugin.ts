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

  // const hub = Sentry.getCurrentHub();

  // fastify.addHook("preHandler", (request) => {
  //   Sentry.configureScope((scope) =>
  //     scope.addEventProcessor((event) => {
  //       event.request = {
  //         method: request.method,
  //         url: request.url,
  //         // headers: request.headers,
  //         query_string: request.query as Record<string, any>,
  //       };

  //       return event;
  //     }),
  //   );
  // });

  fastify.addHook("onError", async (_request, _reply, error) => {
    Sentry.captureException(error);
  });
});
