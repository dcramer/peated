import type { InterceptableOptions, Interceptor } from "@orpc/shared";
import * as Sentry from "@sentry/core";

/**
 * Safely stringify an object, handling circular references and other serialization issues
 */
function safeJsonStringify(obj: unknown): string {
  try {
    const seenObjects = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      // Handle circular references by replacing them with a placeholder
      if (typeof value === "object" && value !== null) {
        if (seenObjects.has(value)) {
          return "[Circular Reference]";
        }
        seenObjects.add(value);
      }

      // Handle functions, symbols, and other non-serializable types
      if (typeof value === "function") {
        return "[Function]";
      }
      if (typeof value === "symbol") {
        return "[Symbol]";
      }
      if (typeof value === "undefined") {
        return "[undefined]";
      }

      return value;
    });
  } catch (error) {
    // If all else fails, return a safe fallback
    return `[Serialization Error: ${error instanceof Error ? error.message : "Unknown"}]`;
  }
}

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
    try {
      return await Sentry.startSpan(
        {
          name: `orpc.${path.join("/")}`,
          attributes: {
            "span.kind": "CLIENT",
            "rpc.system": "orpc",
            "rpc.method": path.join("."),
            ...(options.captureInputs && {
              "rpc.arguments": input ? safeJsonStringify(input) : undefined,
            }),
          },
        },
        async (span) => {
          try {
            const result = await next();
            return result;
          } catch (error) {
            try {
              span.setStatus({
                code: 2,
              });
              Sentry.captureException(error);
            } catch (sentryError) {
              // Log Sentry errors but don't let them interfere with the original error
              console.warn("Sentry interceptor error:", sentryError);
            }

            // Re-throw the original error
            throw error;
          }
        },
      );
    } catch (sentryError) {
      // If Sentry itself fails, log the error and continue with the original call
      console.warn(
        "Sentry interceptor failed, continuing without instrumentation:",
        sentryError,
      );
      return await next();
    }
  };

export default sentryInterceptor;
