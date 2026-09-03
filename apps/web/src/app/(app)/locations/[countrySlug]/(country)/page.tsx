import { serializeCountryStructuredData } from "@peated/web/lib/catalogStructuredData";
import { getCountryPage } from "@peated/web/lib/locationPage.server";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { getCountrySeoMetadata } from "@peated/web/lib/seoMetadata";

import { LocationOverview } from "../../locationOverview.stylex";
import {
  getLocationCategoryItems,
  getLocationDistilleries,
  getLocationLatestReleases,
  getLocationRegions,
} from "../../locationPage";

export async function generateMetadata(props: {
  params: Promise<{ countrySlug: string }>;
}) {
  const { countrySlug } = await props.params;
  const location = await getCountryPage(countrySlug);
  return getCountrySeoMetadata(location);
}

export default async function CountryOverviewPage(props: {
  params: Promise<{ countrySlug: string }>;
}) {
  const { countrySlug } = await props.params;
  const { client } = await getPublicPageServerClient();
  const [country, categories, latestReleases, distilleries, regions] =
    await Promise.all([
      getCountryPage(countrySlug),
      client.countries.categories({ country: countrySlug }),
      client.bottles.list({
        country: countrySlug,
        limit: 5,
        sort: "-release",
      }),
      client.distilleries.list({
        country: countrySlug,
        limit: 5,
        sort: "-bottles",
      }),
      client.regions.list({
        country: countrySlug,
        hasBottles: true,
        limit: 4,
        sort: "-bottles",
      }),
    ]);
  const rootHref = `/locations/${countrySlug}`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeCountryStructuredData(country),
        }}
      />
      <LocationOverview
        categories={getLocationCategoryItems(categories.results)}
        distilleries={getLocationDistilleries(distilleries.results)}
        distillersHref={`${rootHref}/distillers`}
        latestReleases={getLocationLatestReleases(latestReleases.results)}
        productionRules={country.summary}
        regions={getLocationRegions(regions.results)}
        releasesHref={`${rootHref}/bottles?sort=-release`}
        totalBottles={country.totalBottles}
        totalDistillers={country.totalDistillers}
        visual={{ kind: "country", slug: country.slug }}
      />
    </>
  );
}
