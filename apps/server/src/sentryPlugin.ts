import * as Sentry from "@sentry/node-experimental";
import { isString, normalize } from "@sentry/utils";
import fastifyPlugin from "fastify-plugin";

function filterScaries(env: NodeJS.ProcessEnv) {
  return Object.fromEntries(
    Object.entries(env).filter(([k, v]) => {
      return !k.match(/password|secret|auth|key|token/i);
    }),
  );
}

export default fastifyPlugin(async (fastify, options) => {
  fastify.addHook("onRequest", async (request) => {
    Sentry.configureScope((scope) =>
      scope.addEventProcessor((event) => {
        try {
          event.transaction = `${request.method} ${request.routeOptions.url}`;
          event.transaction_info = {
            source: "url",
          };
          if (!event.contexts) event.contexts = {};
          event.contexts.environment = filterScaries(process.env);
          event.request = {
            method: request.method,
            url: `${request.protocol}://${request.hostname}${request.url}`,
            headers: request.headers as Record<string, string>, // idgaf
            query_string: request.query as Record<string, any>,
          };
        } catch (err) {
          console.error(err);
        }

        return event;
      }),
    );
  });

  fastify.addHook("preValidation", async (request) => {
    Sentry.configureScope((scope) =>
      scope.addEventProcessor((event) => {
        if (!event.request) {
          event.request = {
            method: request.method,
            url: `${request.protocol}://${request.hostname}${request.url}`,
            headers: request.headers as Record<string, string>, // idgaf
            query_string: request.query as Record<string, any>,
          };
        }
        try {
          // upgrade the request w/ body
          event.request.data =
            request.body !== undefined
              ? isString(request.body)
                ? request.body
                : JSON.stringify(normalize(request.body))
              : undefined;
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
