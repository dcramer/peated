import { createORPCClient } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import type { Router } from "@peated/server/orpc/router";
import config from "@peated/web/config";
import { getLink } from "./link";

export function createBrowserClient(): RouterClient<Router> {
  const client: RouterClient<Router> = createORPCClient(
    getLink({
      apiServer: config.API_SERVER,
      userAgent: "@peated/web (orpc/react)",
    }),
  );
  return client;
}
