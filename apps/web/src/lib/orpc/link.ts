import { RPCLink } from "@orpc/client/fetch";
import { BatchLinkPlugin } from "@orpc/client/plugins";
import sentryInterceptor from "@peated/orpc/client/interceptors";

export function getLink({
  apiServer,
  accessToken,
  getAccessToken,
  batch,
  userAgent,
  traceContext,
}: {
  apiServer: string;
  accessToken?: string | null;
  getAccessToken?: () => string | null | undefined;
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
    interceptors: [sentryInterceptor({ captureInputs: true })],
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
