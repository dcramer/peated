import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import {
  BOTTLE_CATALOG_ALLOWED_VALUES,
  normalizeBottleCatalogQueryParams,
} from "@peated/web/lib/bottleCatalogQueryParams";
import { getCountryPage } from "@peated/web/lib/locationPage.server";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { getCountrySeoMetadata } from "@peated/web/lib/seoMetadata";

import {
  LOCATION_BOTTLE_DEFAULT_SORT,
  LOCATION_BOTTLE_QUERY_FIELDS,
} from "../../../locationBottleList";
import { LocationBottleListClient } from "../../../locationBottleListClient";

export async function generateMetadata(props: {
  params: Promise<{ countrySlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ countrySlug }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const location = await getCountryPage(countrySlug);
  return getCountrySeoMetadata(location, { section: "bottles", searchParams });
}

export default async function CountryBottlesPage(props: {
  params: Promise<{ countrySlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ countrySlug }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const queryParams = normalizeBottleCatalogQueryParams(
    getApiQueryParams(searchParams, {
      defaults: { sort: LOCATION_BOTTLE_DEFAULT_SORT },
      allowedValues: BOTTLE_CATALOG_ALLOWED_VALUES,
      fields: LOCATION_BOTTLE_QUERY_FIELDS,
      numericFields: ["cursor"],
      overrides: { country: countrySlug, limit: 25 },
    }),
  );
  const { client } = await getPublicPageServerClient();
  const [country, bottleList] = await Promise.all([
    getCountryPage(countrySlug),
    client.bottles.list(queryParams),
  ]);

  return (
    <LocationBottleListClient
      country={countrySlug}
      initialBottleList={bottleList}
      locationName={country.name}
    />
  );
}
