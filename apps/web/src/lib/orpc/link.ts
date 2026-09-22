import { RPCLink } from "@orpc/client/fetch";
import { BatchLinkPlugin } from "@orpc/client/plugins";
import { isORPCClientError } from "@peated/orpc/client/errors";
import sentryInterceptor from "@peated/orpc/client/interceptors";

type ClientErrorCandidate = Parameters<typeof isORPCClientError>[0];

/** Thrown in place of the API error once the member has been sent elsewhere. */
class ORPCAccountRedirectError extends Error {
  name = "ORPCAccountRedirectError";
}

/** API errors that mean the member's account state changed under them. */
export type AccountStateErrorCode = "UNAUTHORIZED" | "ACCOUNT_SUSPENDED";

export function getAccountStateErrorCode(
  error: ClientErrorCandidate,
): AccountStateErrorCode | null {
  if (!isORPCClientError(error)) return null;
  if (error.code === "ACCOUNT_SUSPENDED") return "ACCOUNT_SUSPENDED";
  if (error.status === 401 || error.code === "UNAUTHORIZED") {
    return "UNAUTHORIZED";
  }
  return null;
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

export function isORPCAccountRedirectError(
  error: ClientErrorCandidate,
): error is ORPCAccountRedirectError {
  return (
    error instanceof ORPCAccountRedirectError ||
    (error instanceof Error && error.name === "ORPCAccountRedirectError")
  );
}

export function getLink({
  apiServer,
  accessToken,
  getAccessToken,
  onAccountStateError,
  batch,
  userAgent,
  traceContext,
}: {
  apiServer: string;
  accessToken?: string | null;
  getAccessToken?: () => string | null | undefined;
  /**
   * Called when the API reports an account-state change. Return true after
   * sending the member elsewhere; the request then fails with a redirect
   * error instead of the API error.
   */
  onAccountStateError?: (
    code: AccountStateErrorCode,
  ) => boolean | Promise<boolean>;
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
          const code = getAccountStateErrorCode(err);
          if (code && (await onAccountStateError?.(code))) {
            throw new ORPCAccountRedirectError();
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
