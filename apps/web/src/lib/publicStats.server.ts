"server only";

import { cache } from "react";

import { getAnonymousServerClient } from "./orpc/client.server";

async function loadPublicStats() {
  const { client } = await getAnonymousServerClient();
  return await client.stats();
}

export const getPublicStats = cache(loadPublicStats);
