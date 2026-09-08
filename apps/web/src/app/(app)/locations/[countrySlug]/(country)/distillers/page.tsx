import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { getCountryPage } from "@peated/web/lib/locationPage.server";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { getCountrySeoMetadata } from "@peated/web/lib/seoMetadata";

import { LocationDistillerList } from "../../../locationLists";

export async function generateMetadata(props: {
  params: Promise<{ countrySlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ countrySlug }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const location = await getCountryPage(countrySlug);
  return getCountrySeoMetadata(location, {
    section: "distillers",
    searchParams,
  });
}

export default async function CountryDistillersPage(props: {
  params: Promise<{ countrySlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ countrySlug }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const country = await getCountryPage(countrySlug);
  const queryParams = getApiQueryParams(searchParams, {
    defaults: { sort: "-bottles" },
    numericFields: ["cursor", "limit"],
    overrides: { country: country.slug, limit: 50 },
  });
  const { client } = await getPublicPageServerClient();
  const distillerList = await client.distilleries.list(queryParams);
  const pathname = `/locations/${country.slug}/distillers`;
  const page = Number(queryParams.cursor ?? 1) || 1;

  return (
    <LocationDistillerList
      items={distillerList.results}
      name={country.name}
      nextHref={getCursorHref(
        pathname,
        searchParams,
        distillerList.rel.nextCursor,
      )}
      page={page}
      previousHref={getCursorHref(
        pathname,
        searchParams,
        distillerList.rel.prevCursor,
      )}
    />
  );
}
