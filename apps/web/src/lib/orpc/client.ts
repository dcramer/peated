import { createORPCClient } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import type { Router } from "@peated/server/orpc/router";
import config from "@peated/web/config";
import { getLink, type ClientContext } from "./link";

export type { ClientContext } from "./link";

export interface BrowserClient {
  client: RouterClient<Router, ClientContext>;
}

export function createBrowserClient(
  context: ClientContext = {},
): BrowserClient {
  const client: RouterClient<Router, ClientContext> = createORPCClient(
    getLink({
      apiServer: config.API_SERVER,
      userAgent: "@peated/web (orpc/client)",
      accessToken: context.accessToken,
      traceContext: context.traceContext,
    }),
  );
  return { client };
}
