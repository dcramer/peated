import { RPCLink } from "@orpc/client/fetch";
import { BatchLinkPlugin } from "@orpc/client/plugins";
import { isORPCClientError } from "@peated/orpc/client/errors";
import sentryInterceptor from "@peated/orpc/client/interceptors";

type ClientErrorCandidate = Parameters<typeof isORPCClientError>[0];

class ORPCUnauthorizedRedirectError extends Error {
  name = "ORPCUnauthorizedRedirectError";
}

export type ORPCResponseTraceContext = {
  sentryTraceId: string | null;
};

export interface ClientContext {
  accessToken?: string | null;
  responseTraceContext?: ORPCResponseTraceContext;
  traceContext?: {
    sentryTrace?: string | null;
    baggage?: string | null;
  };
}

interface ORPCRequestHeaders {
  [name: string]: string | undefined;
  authorization: string | undefined;
  "user-agent": string;
  "sentry-trace"?: string | undefined;
  baggage?: string | undefined;
}

const SENTRY_TRACE_ID_PATTERN = /^[0-9a-f]{32}$/;

/** Creates caller-owned response trace state populated from `x-sentry-trace-id`. */
export function createORPCResponseTraceContext(): ORPCResponseTraceContext {
  return { sentryTraceId: null };
}

function parseSentryTraceId(traceId: string | null): string | null {
  return traceId && SENTRY_TRACE_ID_PATTERN.test(traceId) ? traceId : null;
}

export function isORPCUnauthorizedRedirectError(
  error: ClientErrorCandidate,
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
  return new RPCLink<ClientContext>({
    headers() {
      const token = getAccessToken ? getAccessToken() : accessToken;

      const headers: ORPCRequestHeaders = {
        authorization: token ? `Bearer ${token}` : undefined,
        "user-agent": userAgent,
      };
      if (traceContext) {
        headers["sentry-trace"] = traceContext.sentryTrace ?? undefined;
        headers.baggage = traceContext.baggage ?? undefined;
      }
      return headers;
    },
    url: `${apiServer}/rpc`,
    adapterInterceptors: [
      async ({ next, ...options }) => {
        const response = await next(options);
        const responseTraceContext = options.context.responseTraceContext;
        if (responseTraceContext) {
          responseTraceContext.sentryTraceId = parseSentryTraceId(
            response.headers.get("x-sentry-trace-id"),
          );
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
      sentryInterceptor(),
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
