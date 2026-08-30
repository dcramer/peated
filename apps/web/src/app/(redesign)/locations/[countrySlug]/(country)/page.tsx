import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";

import { LocationDistillerList } from "../../locationLists";

export default async function CountryDistillersPage(props: {
  params: Promise<{ countrySlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ countrySlug }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const queryParams = getApiQueryParams(searchParams, {
    defaults: { sort: "-bottles" },
    numericFields: ["cursor", "limit"],
    overrides: { country: countrySlug, limit: 50 },
  });
  const { client } = await getPublicPageServerClient();
  const distillerList = await client.distilleries.list(queryParams);
  const pathname = `/locations/${countrySlug}`;
  const page = Number(queryParams.cursor ?? 1) || 1;

  return (
    <LocationDistillerList
      items={distillerList.results}
      name={countrySlug.replaceAll("-", " ")}
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
