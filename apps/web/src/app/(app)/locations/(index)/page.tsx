import { CardGrid, LocationCard } from "@peated/web/components";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { getCatalogSeoMetadata } from "@peated/web/lib/seoMetadata";

export const metadata = getCatalogSeoMetadata({
  title: "Whisky locations",
  description:
    "Browse whisky countries and regions, with bottles, distilleries, ratings, and tasting notes.",
  url: "/locations",
});

export default async function LocationsPage() {
  const { client } = await getAnonymousServerClient();
  const countryList = await client.countries.list({
    onlyMajor: true,
    sort: "-bottles",
  });

  return (
    <CardGrid>
      {countryList.results.map((country) => (
        <LocationCard
          href={`/locations/${country.slug}`}
          key={country.slug}
          name={country.name}
          slug={country.slug}
          summary={country.summary}
          totalBottles={country.totalBottles}
          totalDistillers={country.totalDistillers}
        />
      ))}
    </CardGrid>
  );
}
