"server only";

import { cache } from "react";

import { getAnonymousServerClient } from "./orpc/client.server";
import { resolveOrNotFound } from "./orpc/notFound.server";

export const getCountryPage = cache(async (countrySlug: string) => {
  const { client } = await getAnonymousServerClient();
  return await resolveOrNotFound(
    client.countries.details({ country: countrySlug }),
  );
});

export const getRegionPage = cache(
  async (countrySlug: string, regionSlug: string) => {
    const { client } = await getAnonymousServerClient();
    return await resolveOrNotFound(
      client.regions.details({ country: countrySlug, region: regionSlug }),
    );
  },
);
