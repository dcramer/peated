import { createORPCClient } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { type Router } from "@peated/server/orpc/router";
import { getTraceData } from "@sentry/core";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";
import { ORPCContext } from "./context";
import { getLink, type AccountStateErrorCode } from "./link";
import { getQueryClient } from "./query";

export default function ORPCProvider({
  accessToken,
  apiServer,
  onAccountStateError,
  ...props
}: {
  accessToken?: string | null;
  apiServer: string;
  onAccountStateError?: (
    code: AccountStateErrorCode,
  ) => boolean | Promise<boolean>;
} & Omit<ComponentProps<typeof ORPCContext.Provider>, "value">) {
  const queryClient = getQueryClient(false);
  const traceData = getTraceData();
  const accessTokenRef = useRef(accessToken);
  const previousAccessTokenRef = useRef(accessToken);
  const onAccountStateErrorRef = useRef(onAccountStateError);

  accessTokenRef.current = accessToken;
  onAccountStateErrorRef.current = onAccountStateError;

  useEffect(() => {
    if (previousAccessTokenRef.current !== accessToken) {
      queryClient.removeQueries({ type: "inactive" });
      previousAccessTokenRef.current = accessToken;
    }
  }, [accessToken, queryClient]);

  const [client] = useState<RouterClient<Router>>(() =>
    createORPCClient(
      getLink({
        apiServer,
        getAccessToken: () => accessTokenRef.current,
        userAgent: "@peated/web (orpc/tanstack-query)",
        onAccountStateError: (code) =>
          onAccountStateErrorRef.current?.(code) ?? false,
        traceContext: {
          sentryTrace: traceData["sentry-trace"],
          baggage: traceData.baggage,
        },
      }),
    ),
  );
  const [orpc] = useState(() => createTanstackQueryUtils(client));

  return (
    <ORPCContext.Provider value={orpc} {...props}>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </ORPCContext.Provider>
  );
}
