"server only";

import { createORPCClient } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import type { Router } from "@peated/server/orpc/router";
import config from "@peated/web/config";
import { headers } from "next/headers";
import { cache } from "react";
import { getSession } from "../session.server";
import type { ClientContext } from "./client";
import { getLink } from "./link";

export async function createServerClient(
  context: ClientContext = {}
): Promise<{ client: RouterClient<Router, ClientContext> }> {
  const session = await getSession();
  const accessToken = session.accessToken;

  if (context.traceContext === undefined) {
    const reqHeaders = headers();
    context.traceContext = {
      sentryTrace: reqHeaders.get("sentry-trace"),
      baggage: reqHeaders.get("baggage"),
    };
  }
  const link = getLink({
    accessToken: context.accessToken ?? accessToken,
    // https://peated.sentry.io/share/issue/c6bccda67b0648caa6949aed4d72abb3/
    batch: false,
    apiServer: config.API_SERVER,
    userAgent: "@peated/web (orpc/server)",
    traceContext: context.traceContext,
  });

  const client: RouterClient<Router, ClientContext> = createORPCClient(link);
  return { client };
}

// TODO: this is a little risky to cache given its variable based on the session
export const getServerClient = cache(createServerClient);
