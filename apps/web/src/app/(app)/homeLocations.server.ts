"server only";

import { createAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import type { ORPCQueryUtils } from "@peated/web/lib/orpc/context";
import {
  homeLocationCriteria,
  publicHomeQueries,
} from "@peated/web/lib/orpc/homeQueries";
import type { QueryClient } from "@tanstack/react-query";
import { unstable_cache } from "next/cache";

const ONE_HOUR_IN_SECONDS = 60 * 60;

// Web caching rule: shared homepage data always uses an anonymous client.
const loadPublicHomeCountries = unstable_cache(
  async () => {
    const { client } = await createAnonymousServerClient();
    return client.countries.list(homeLocationCriteria.countries);
  },
  ["public-home-countries"],
  { revalidate: ONE_HOUR_IN_SECONDS },
);

const loadPublicHomeRegions = unstable_cache(
  async () => {
    const { client } = await createAnonymousServerClient();
    return client.regions.list(homeLocationCriteria.regions);
  },
  ["public-home-regions"],
  { revalidate: ONE_HOUR_IN_SECONDS },
);

export async function loadPublicHomeLocations(
  queryClient: QueryClient,
  orpc: ORPCQueryUtils,
) {
  await Promise.all([
    queryClient.prefetchQuery({
      ...publicHomeQueries.countries(orpc),
      queryFn: loadPublicHomeCountries,
    }),
    queryClient.prefetchQuery({
      ...publicHomeQueries.regions(orpc),
      queryFn: loadPublicHomeRegions,
    }),
  ]);
}
