import { CursorPager } from "@peated/web/components";
import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { getCatalogSeoMetadata } from "@peated/web/lib/seoMetadata";

import { LocationTable } from "../../locationLists";

export async function generateMetadata(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return getCatalogSeoMetadata(
    {
      title: "Whisky countries",
      description: "Browse every whisky-producing country recorded by Peated.",
      url: "/locations/all-regions",
    },
    await props.searchParams,
  );
}

export default async function AllLocationsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const queryParams = getApiQueryParams(searchParams, {
    defaults: { sort: "-bottles" },
    numericFields: ["cursor", "limit"],
    overrides: { hasBottles: true, limit: 50 },
  });
  const { client } = await getAnonymousServerClient();
  const countryList = await client.countries.list(queryParams);
  const page = Number(queryParams.cursor ?? 1) || 1;

  return (
    <>
      <LocationTable
        caption="Whisky-producing countries"
        getHref={(country) => `/locations/${country.slug}`}
        items={countryList.results}
      />
      <CursorPager
        ariaLabel="Location pages"
        nextHref={getCursorHref(
          "/locations/all-regions",
          searchParams,
          countryList.rel.nextCursor,
        )}
        page={page}
        previousHref={getCursorHref(
          "/locations/all-regions",
          searchParams,
          countryList.rel.prevCursor,
        )}
      />
    </>
  );
}
