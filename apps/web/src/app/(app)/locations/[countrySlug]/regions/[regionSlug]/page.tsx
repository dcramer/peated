import { getRegionPage } from "@peated/web/lib/locationPage.server";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";

import { LocationOverview } from "../../../locationOverview.stylex";
import {
  getLocationCategoryItems,
  getLocationDistilleries,
  getLocationLatestReleases,
} from "../../../locationPage";

export default async function RegionOverviewPage(props: {
  params: Promise<{ countrySlug: string; regionSlug: string }>;
}) {
  const { countrySlug, regionSlug } = await props.params;
  const { client } = await getPublicPageServerClient();
  const [region, categories, latestReleases, distilleries] = await Promise.all([
    getRegionPage(countrySlug, regionSlug),
    client.regions.categories({ country: countrySlug, region: regionSlug }),
    client.bottles.list({
      country: countrySlug,
      region: regionSlug,
      limit: 5,
      sort: "-release",
    }),
    client.distilleries.list({
      country: countrySlug,
      region: regionSlug,
      limit: 5,
      sort: "-bottles",
    }),
  ]);
  const isUsState = countrySlug === "united-states";
  const rootHref = `/locations/${countrySlug}/regions/${regionSlug}`;

  return (
    <LocationOverview
      categories={getLocationCategoryItems(categories.results)}
      distilleries={getLocationDistilleries(distilleries.results)}
      distillersHref={`${rootHref}/distillers`}
      latestReleases={getLocationLatestReleases(latestReleases.results)}
      releasesHref={`${rootHref}/bottles?sort=-release`}
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
