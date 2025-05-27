import { os } from "@orpc/server";
import * as Sentry from "@sentry/core";

type Options = {
  captureInputs?: boolean;
};

/**
 * Creates Sentry middleware for oRPC procedures that automatically instruments
 * RPC calls with distributed tracing and error reporting on the server side.
 *
 * @param options - Configuration options for the middleware
 * @param options.captureInputs - Whether to capture RPC input arguments in span attributes (default: false)
 * @returns Middleware function that wraps oRPC procedure calls with Sentry spans
 *
 * @example
 * ```ts
 * import { os } from "@orpc/server";
 * import sentryMiddleware from "@peated/orpc/server/middleware";
 *
 * const base = os.$context<{ user: User | null }>().errors({
 *   UNAUTHORIZED: { message: "Unauthorized.", statusCode: 401, error: "Unauthorized" },
 *   // ... other errors
 * });
 *
 * // Base procedure with Sentry error tracking for all routes
 * export const procedure = base.use(sentryMiddleware);
 * ```
 */
const sentryMiddleware = (options: Options = {}) =>
  os.middleware(async ({ next, path }, input) => {
    return await Sentry.startSpan(
      {
        name: `orpc.${path.join("/")}`,
        attributes: {
          "rpc.system": "orpc",
          "rpc.method": path.join("."),
          ...(options.captureInputs && {
            "rpc.arguments": input ? JSON.stringify(input) : undefined,
          }),
        },
      },
      async (span) => {
        try {
          return await next();
        } catch (error) {
          span.setStatus({
            code: 2,
          });
          Sentry.captureException(error);

          // Re-throw the error so it can be handled by the error handler
          throw error;
        }
      },
    );
  });

export default sentryMiddleware;
