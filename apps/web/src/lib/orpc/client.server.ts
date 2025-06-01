"server only";

import { createORPCClient } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import type { Router } from "@peated/server/orpc/router";
import config from "@peated/web/config";
import type { ClientContext } from "./client";
import { getLink } from "./link";

export type ServerClient = RouterClient<Router, ClientContext>;

export function getServerClient(context: ClientContext = {}): ServerClient {
  const link = getLink({
    accessToken: context.accessToken,
    // https://peated.sentry.io/share/issue/c6bccda67b0648caa6949aed4d72abb3/
    batch: false,
    apiServer: config.API_SERVER,
    userAgent: "@peated/web (orpc/server)",
    traceContext: context.traceContext,
  });

  const client: RouterClient<Router, ClientContext> = createORPCClient(link);
  return client;
}
