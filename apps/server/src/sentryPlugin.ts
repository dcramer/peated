import * as Sentry from "@sentry/node";
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
  fastify.addHook("preValidation", async (request) => {
    Sentry.addEventProcessor((event) => {
      if (!event.request) {
        event.request = {};
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
    });
  });

  fastify.addHook("onError", async (_request, _reply, error) => {
    Sentry.captureException(error);
  });
});
