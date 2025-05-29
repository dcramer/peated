import type { InterceptableOptions, Interceptor } from "@orpc/shared";
import * as Sentry from "@sentry/core";

type Options = {
  captureInputs?: boolean;
};

/**
 * Creates a Sentry interceptor for oRPC calls that automatically instruments
 * RPC calls with distributed tracing and error reporting.
 *
 * @param options - Configuration options for the interceptor
 * @param options.captureInputs - Whether to capture RPC input arguments in span attributes (default: false)
 * @returns An interceptor function that wraps oRPC calls with Sentry spans
 *
 * @example
 * ```ts
 * import { RPCLink } from "@orpc/client/fetch";
 * import sentryInterceptor from "@peated/orpc/client/interceptors";
 *
 * const link = new RPCLink({
 *   url: "https://api.example.com/rpc",
 *   interceptors: [sentryInterceptor({ captureInputs: true })],
 * });
 * ```
 */
const sentryInterceptor = (
  options: Options = {},
): Interceptor<InterceptableOptions, Promise<unknown>> =>
  async function sentryInterceptor({ next, path, input }) {
    return await Sentry.startSpan(
      {
        name: `orpc.${path.join("/")}`,
        attributes: {
          "span.kind": "CLIENT",
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
  };

export default sentryInterceptor;
