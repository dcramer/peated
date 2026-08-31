import { CursorPager, EmptyState } from "@peated/web/components";
import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";

import { REGION_LIST_SORT_OPTIONS } from "@peated/server/constants";
import { LocationTable } from "../../../locationLists";

const REGION_QUERY_FIELDS = [
  "cursor",
  "hasBottles",
  "limit",
  "query",
  "sort",
] as const;
export default async function CountryRegionsPage(props: {
  params: Promise<{ countrySlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ countrySlug }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const queryParams = getApiQueryParams(searchParams, {
    defaults: { sort: "-bottles" },
    allowedValues: { sort: REGION_LIST_SORT_OPTIONS },
    fields: REGION_QUERY_FIELDS,
    numericFields: ["cursor", "limit"],
    overrides: { country: countrySlug, limit: 100 },
  });
  const { client } = await getPublicPageServerClient();
  const regionList = await client.regions.list(queryParams);
  const pathname = `/locations/${countrySlug}/regions`;
  const page = Number(queryParams.cursor ?? 1) || 1;

  return (
    <>
      {regionList.results.length ? (
        <LocationTable
          caption={`Whisky regions in ${countrySlug.replaceAll("-", " ")}`}
          getHref={(region) => `${pathname}/${region.slug}`}
          items={regionList.results}
        />
      ) : (
        <EmptyState heading="No regions yet">
          No whisky regions have been recorded for this country.
        </EmptyState>
      )}
      <CursorPager
        ariaLabel="Region pages"
        nextHref={getCursorHref(
          pathname,
          searchParams,
          regionList.rel.nextCursor,
        )}
        page={page}
        previousHref={getCursorHref(
          pathname,
          searchParams,
          regionList.rel.prevCursor,
        )}
      />
    </>
  );
}
