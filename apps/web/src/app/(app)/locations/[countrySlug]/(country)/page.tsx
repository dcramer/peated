import { getCountryPage } from "@peated/web/lib/locationPage.server";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";

import { LocationOverview } from "../../locationOverview.stylex";
import {
  getLocationCategoryItems,
  getLocationPopularBottles,
} from "../../locationPage";

export default async function CountryOverviewPage(props: {
  params: Promise<{ countrySlug: string }>;
}) {
  const { countrySlug } = await props.params;
  const { client } = await getPublicPageServerClient();
  const [country, categories, popularBottles] = await Promise.all([
    getCountryPage(countrySlug),
    client.countries.categories({ country: countrySlug }),
    client.bottles.list({
      country: countrySlug,
      limit: 5,
      sort: "-tastings",
    }),
  ]);

  return (
    <LocationOverview
      categories={getLocationCategoryItems(categories.results)}
      popularBottles={getLocationPopularBottles(popularBottles.results)}
      productionRules={country.summary}
      totalBottles={country.totalBottles}
      totalDistillers={country.totalDistillers}
      visual={{ kind: "country", slug: country.slug }}
    />
  );
}
