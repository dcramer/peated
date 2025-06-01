import { BOT_USER_AGENT } from "@peated/server/constants";
import { db } from "@peated/server/db";
import type { Country } from "@peated/server/db/schema";
import { countries } from "@peated/server/db/schema";
import { OSMSchema } from "@peated/server/lib/osm";
import axios from "axios";
import { eq } from "drizzle-orm";

export default async ({ countryId }: { countryId: number }) => {
  const country = await db.query.countries.findFirst({
    where: (countries, { eq }) => eq(countries.id, countryId),
  });
  if (!country) {
    throw new Error(`Unknown country: ${countryId}`);
  }

  // add &polygon_geojson=1 to get shape
  const { data } = await axios.get(
    `https://nominatim.openstreetmap.org/search.php?q=${encodeURIComponent(country.name)}&format=geojson`,
    {
      headers: {
        "User-Agent": BOT_USER_AGENT,
      },
    }
  );

  const parsed = OSMSchema.parse(data);

  // state is included for things like Scotland
  const match = parsed.features.find(
    (f) =>
      (f.properties.addresstype === "country" ||
        f.properties.addresstype === "province" ||
        f.properties.addresstype === "state") &&
      f.properties.type === "administrative" &&
      f.properties.importance > 0.5
  );

  if (!match) {
    throw new Error(
      `Failed to geocode country (no valid matches): ${country.slug}}`
    );
  }

  const updates: Partial<Country> = {
    // we expect lat, lng, but geojson is lng, lat seemingly
    location: [match.geometry.coordinates[1], match.geometry.coordinates[0]],
  };

  await db.update(countries).set(updates).where(eq(countries.id, country.id));
};
