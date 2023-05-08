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

    const transactionName = request.routerPath;
    const transaction = Sentry.startTransaction({
      name: transactionName,
      op: "http.server",
      ...traceparentData,
    });

    request._sentryContext = {
      transaction,
    };

    Sentry.configureScope((scope) => {
      // LOVE THAT I HAVE TO CALL TWO CALLS FOR BASICS
      scope.setSpan(transaction);
      scope.setTransactionName(transactionName);
    });
  });

  fastify.addHook("onResponse", async (request, reply) => {
    setImmediate(() => {
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
