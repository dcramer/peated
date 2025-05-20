"server only";

import { createORPCClient } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import type { Router } from "@peated/server/orpc/router";
import config from "@peated/web/config";
import { cache } from "react";
import { getSession } from "../session.server";
import { getLink } from "./link";

export async function createServerClient(): Promise<RouterClient<Router>> {
  const session = await getSession();
  const accessToken = session.accessToken;

  const client: RouterClient<Router> = createORPCClient(
    getLink({
      accessToken,
      batch: true,
      apiServer: config.API_SERVER,
      userAgent: "@peated/web (orpc/react)",
    }),
  );
  return client;
}

export const getServerClient = cache(createServerClient);
