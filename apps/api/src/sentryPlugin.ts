import fastifyPlugin from "fastify-plugin";
import * as Sentry from "@sentry/node";
import { extractTraceparentData } from "@sentry/utils";

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

  fastify.addHook("onRequest", async function (request, _reply) {
    const traceparentData =
      request.headers["sentry-trace"] &&
      extractTraceparentData(
        Array.isArray(request.headers["sentry-trace"])
          ? request.headers["sentry-trace"][0]
          : request.headers["sentry-trace"]
      );

    const transaction = Sentry.startTransaction({
      name: request.routerPath,
      op: "http.server",
      ...traceparentData,
    });

    request._sentryContext = {
      transaction,
    };

    Sentry.configureScope((scope) => {
      scope.setSpan(transaction);
    });
  });

  fastify.addHook("onResponse", async (request, reply) => {
    setImmediate(() => {
      console.log(request._sentryContext);
      if (request._sentryContext && request._sentryContext.transaction) {
        const transaction = request._sentryContext.transaction;
        // addRequestDataToTransaction(transaction, req);
        transaction.setHttpStatus(reply.statusCode);
        transaction.finish();
      }
    });
  });

  fastify.addHook("onError", async (_request, _reply, error) => {
    Sentry.captureException(error);
  });
});
