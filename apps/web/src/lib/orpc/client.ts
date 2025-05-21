import { createORPCClient } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import type { Router } from "@peated/server/orpc/router";
import config from "@peated/web/config";
import { getLink } from "./link";

export interface ClientContext {
  accessToken?: string;
  traceContext?: {
    sentryTrace?: string | null;
    baggage?: string | null;
  };
}

export function createBrowserClient(
  context: ClientContext = {},
): RouterClient<Router, ClientContext> {
  const client: RouterClient<Router, ClientContext> = createORPCClient(
    getLink({
      apiServer: config.API_SERVER,
      userAgent: "@peated/web (orpc/client)",
      accessToken: context.accessToken,
      traceContext: context.traceContext,
    }),
  );
  return client;
}
