"server only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import { getAnonymousServerClient } from "./orpc/client.server";

async function loadPublicStats() {
  const { client } = await getAnonymousServerClient();
  return await client.stats();
}

const loadCachedPublicStats = unstable_cache(
  loadPublicStats,
  ["public-stats"],
  {
    revalidate: 60 * 60,
    tags: ["public-stats"],
  },
);

export const getPublicStats = cache(loadCachedPublicStats);
