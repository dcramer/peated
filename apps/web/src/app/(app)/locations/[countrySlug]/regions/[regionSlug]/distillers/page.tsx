import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { getRegionPage } from "@peated/web/lib/locationPage.server";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { getRegionSeoMetadata } from "@peated/web/lib/seoMetadata";

import { LocationDistillerList } from "../../../../locationLists";

export async function generateMetadata(props: {
  params: Promise<{ countrySlug: string; regionSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ countrySlug, regionSlug }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const location = await getRegionPage(countrySlug, regionSlug);
  return getRegionSeoMetadata(location, {
    section: "distillers",
    searchParams,
  });
}

export default async function RegionDistillersPage(props: {
  params: Promise<{ countrySlug: string; regionSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ countrySlug, regionSlug }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const queryParams = getApiQueryParams(searchParams, {
    defaults: { sort: "-bottles" },
    numericFields: ["cursor", "limit"],
    overrides: { country: countrySlug, limit: 50, region: regionSlug },
  });
  const { client } = await getPublicPageServerClient();
  const [region, distillerList] = await Promise.all([
    getRegionPage(countrySlug, regionSlug),
    client.distilleries.list(queryParams),
  ]);
  const pathname = `/locations/${countrySlug}/regions/${regionSlug}/distillers`;
  const page = Number(queryParams.cursor ?? 1) || 1;

  return (
    <LocationDistillerList
      items={distillerList.results}
      name={region.name}
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
