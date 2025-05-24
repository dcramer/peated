import { RPCLink } from "@orpc/client/fetch";
import { logError } from "../log";

export function getLink({
  apiServer,
  accessToken,
  batch,
  userAgent,
  traceContext,
}: {
  apiServer: string;
  accessToken?: string | null;
  batch?: boolean;
  userAgent: string;
  traceContext?: {
    sentryTrace?: string | null;
    baggage?: string | null;
  };
}) {
  return new RPCLink({
    headers() {
      return {
        authorization: accessToken ? `Bearer ${accessToken}` : undefined,
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
    interceptors: [
      async ({ next, path }) => {
        try {
          return await next();
        } catch (error) {
          logError(error);
          throw error;
        }
      },
    ],
  });
}
