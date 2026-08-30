import {
  CardGrid,
  LocationCard,
} from "@peated/web/components/designSystem/components";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Whisky Locations",
  description: "Browse whisky-producing countries recorded by Peated.",
};

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
