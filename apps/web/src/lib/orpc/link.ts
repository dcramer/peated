import { RPCLink } from "@orpc/client/fetch";

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
    async headers() {
      return {
        authorization: accessToken ? `Bearer ${accessToken}` : "",
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
  });
}
