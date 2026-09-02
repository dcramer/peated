import { getRegionPage } from "@peated/web/lib/locationPage.server";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";

import { LocationOverview } from "../../../locationOverview.stylex";
import {
  getLocationCategoryItems,
  getLocationPopularBottles,
} from "../../../locationPage";

export default async function RegionOverviewPage(props: {
  params: Promise<{ countrySlug: string; regionSlug: string }>;
}) {
  const { countrySlug, regionSlug } = await props.params;
  const { client } = await getPublicPageServerClient();
  const [region, categories, popularBottles] = await Promise.all([
    getRegionPage(countrySlug, regionSlug),
    client.regions.categories({ country: countrySlug, region: regionSlug }),
    client.bottles.list({
      country: countrySlug,
      region: regionSlug,
      limit: 5,
      sort: "-tastings",
    }),
  ]);
  const isUsState = countrySlug === "united-states";

  return (
    <LocationOverview
      categories={getLocationCategoryItems(categories.results)}
      popularBottles={getLocationPopularBottles(popularBottles.results)}
      totalBottles={region.totalBottles}
      totalDistillers={region.totalDistillers}
      visual={
        isUsState
          ? { kind: "state", slug: region.slug }
          : { kind: "country", slug: region.country.slug }
      }
      visualHeading={isUsState ? "Map" : `In ${region.country.name}`}
    />
  );
}
