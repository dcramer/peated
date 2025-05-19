"server only";

import { createORPCClient } from "@orpc/client";
import config from "@peated/web/config";
import { cache } from "react";
import { getSession } from "../session.server";
import { getLink } from "./link";

async function createServerClient() {
  const session = await getSession();
  const accessToken = session.accessToken;

  return createORPCClient(
    getLink({
      accessToken,
      batch: true,
      apiServer: config.API_SERVER,
      userAgent: "@peated/web (orpc/react)",
    }),
  );
}

export const getOrpcClient = cache(createServerClient);

globalThis.$client = createServerClient();
