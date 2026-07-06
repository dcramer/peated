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
  os.middleware(async ({ context, next, path }, input) => {
    return await Sentry.startSpan(
      {
        op: "rpc.server",
        name: `orpc.${path.join("/")}`,
        attributes: {
          "rpc.system": "orpc",
          "rpc.service": "peated.orpc",
          "rpc.method": path.join("."),
          ...(options.captureInputs && {
            "rpc.arguments": input ? JSON.stringify(input) : undefined,
          }),
        },
      },
      async (span) => {
        const traceId = span.spanContext().traceId;
        const contextWithHeaders = context as typeof context & {
          resHeaders?: Headers;
          sentryTraceId?: string;
        };
        contextWithHeaders.resHeaders?.set("x-sentry-trace-id", traceId);

        try {
          return await next({
            context: {
              ...context,
              sentryTraceId: traceId,
            },
          });
        } catch (error) {
          span.setStatus({
            code: 2,
          });

          // Log error to console for development/debugging
          console.error(
            `[ORPC Error] ${path.join("/")}:`,
            error,
            options.captureInputs
              ? `\nInput: ${JSON.stringify(input, null, 2)}`
              : "",
          );

          Sentry.captureException(error);

          // Re-throw the error so it can be handled by the error handler
          throw error;
        }
      },
    );
  });

export default sentryMiddleware;
