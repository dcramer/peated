import { RPCLink } from "@orpc/client/fetch";
import { BatchLinkPlugin } from "@orpc/client/plugins";
import { isORPCClientError } from "@peated/orpc/client/errors";
import sentryInterceptor from "@peated/orpc/client/interceptors";

class ORPCUnauthorizedRedirectError extends Error {
  name = "ORPCUnauthorizedRedirectError";
}

export type ORPCResponseTraceContext = {
  sentryTraceId: string | null;
};

export function createORPCResponseTraceContext(): ORPCResponseTraceContext {
  return { sentryTraceId: null };
}

export function isORPCUnauthorizedRedirectError(
  error: unknown,
): error is ORPCUnauthorizedRedirectError {
  return (
    error instanceof ORPCUnauthorizedRedirectError ||
    (error instanceof Error && error.name === "ORPCUnauthorizedRedirectError")
  );
}

export function getLink({
  apiServer,
  accessToken,
  getAccessToken,
  onUnauthorized,
  batch,
  userAgent,
  traceContext,
}: {
  apiServer: string;
  accessToken?: string | null;
  getAccessToken?: () => string | null | undefined;
  onUnauthorized?: () => boolean | Promise<boolean>;
  batch?: boolean;
  userAgent: string;
  traceContext?: {
    sentryTrace?: string | null;
    baggage?: string | null;
  };
}) {
  return new RPCLink({
    headers() {
      const token = getAccessToken ? getAccessToken() : accessToken;

      return {
        authorization: token ? `Bearer ${token}` : undefined,
        "user-agent": userAgent,
        ...(traceContext
          ? {
              "sentry-trace": traceContext.sentryTrace ?? undefined,
              baggage: traceContext.baggage ?? undefined,
            }
          : {}),
      };
    },
    url: `${apiServer}/rpc`,
    adapterInterceptors: [
      async ({ next, ...options }) => {
        const response = await next(options);
        const responseTraceContext = options.context.responseTraceContext as
          | ORPCResponseTraceContext
          | undefined;
        if (responseTraceContext) {
          responseTraceContext.sentryTraceId =
            response.headers.get("x-sentry-trace-id");
        }
        return response;
      },
    ],
    interceptors: [
      async ({ next, ...options }) => {
        try {
          return await next(options);
        } catch (err) {
          if (
            isORPCClientError(err) &&
            (err.status === 401 || err.name === "UNAUTHORIZED")
          ) {
            if (await onUnauthorized?.()) {
              throw new ORPCUnauthorizedRedirectError();
            }
          }
          throw err;
        }
      },
      sentryInterceptor({ captureInputs: true }),
    ],
    plugins: [
      new BatchLinkPlugin({
        groups: [
          {
            condition: (options) => !!batch,
            context: {},
          },
        ],
      }),
    ],
  });
}
