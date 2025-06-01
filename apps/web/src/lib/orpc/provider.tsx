import { createORPCClient } from "@orpc/client";
import { createORPCReactQueryUtils } from "@orpc/react-query";
import type { RouterClient } from "@orpc/server";
import type { Router } from "@peated/server/orpc/router";
import { getTraceData } from "@sentry/core";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { useState } from "react";
import { ORPCContext } from "./context";
import { getLink } from "./link";
import { getQueryClient } from "./query";

export default function ORPCProvider({
  accessToken,
  apiServer,
  ...props
}: { accessToken?: string | null; apiServer: string } & Omit<
  ComponentProps<typeof ORPCContext.Provider>,
  "value"
>) {
  const queryClient = getQueryClient(false);
  const traceData = getTraceData();

  const [client] = useState<RouterClient<Router>>(() =>
    createORPCClient(
      getLink({
        apiServer,
        accessToken,
        userAgent: "@peated/web (orpc/react)",
        traceContext: {
          sentryTrace: traceData["sentry-trace"],
          baggage: traceData.baggage,
        },
      })
    )
  );
  const [orpc] = useState(() => createORPCReactQueryUtils(client));

  return (
    <ORPCContext.Provider value={orpc} {...props}>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </ORPCContext.Provider>
  );
}
