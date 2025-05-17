import { createORPCClient } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { type Router } from "@peated/server/orpc/router";
import config from "@peated/web/config";
import { getLink } from "./link";

declare global {
  let $client: RouterClient<Router> | undefined;
}

function createBrowserClient() {
  return createORPCClient(
    getLink({
      apiServer: config.API_SERVER,
      userAgent: "@peated/web (orpc/react)",
    }),
  );
}

/**
 * Fallback to client-side client if server-side client is not available.
 */
export const client: RouterClient<Router> =
  globalThis.$client ?? createBrowserClient();
