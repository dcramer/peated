import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import {
  BOTTLE_CATALOG_ALLOWED_VALUES,
  normalizeBottleCatalogQueryParams,
} from "@peated/web/lib/bottleCatalogQueryParams";
import { getRegionPage } from "@peated/web/lib/locationPage.server";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { getRegionSeoMetadata } from "@peated/web/lib/seoMetadata";

import {
  LOCATION_BOTTLE_DEFAULT_SORT,
  LOCATION_BOTTLE_QUERY_FIELDS,
} from "../../../../locationBottleList";
import { LocationBottleListClient } from "../../../../locationBottleListClient";

export async function generateMetadata(props: {
  params: Promise<{ countrySlug: string; regionSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ countrySlug, regionSlug }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const location = await getRegionPage(countrySlug, regionSlug);
  return getRegionSeoMetadata(location, { section: "bottles", searchParams });
}

export default async function RegionBottlesPage(props: {
  params: Promise<{ countrySlug: string; regionSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ countrySlug, regionSlug }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const queryParams = normalizeBottleCatalogQueryParams(
    getApiQueryParams(searchParams, {
      defaults: { sort: LOCATION_BOTTLE_DEFAULT_SORT },
      allowedValues: BOTTLE_CATALOG_ALLOWED_VALUES,
      fields: LOCATION_BOTTLE_QUERY_FIELDS,
      numericFields: ["cursor"],
      overrides: {
        country: countrySlug,
        limit: 25,
        region: regionSlug,
      },
    }),
  );
  const { client } = await getPublicPageServerClient();
  const [region, bottleList] = await Promise.all([
    getRegionPage(countrySlug, regionSlug),
    client.bottles.list(queryParams),
  ]);

  return (
    <LocationBottleListClient
      country={countrySlug}
      initialBottleList={bottleList}
      locationName={region.name}
      region={regionSlug}
    />
  );
}
