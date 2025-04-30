import { BOT_USER_AGENT } from "@peated/server/constants";
import { db } from "@peated/server/db";
import type { Country } from "@peated/server/db/schema";
import { regions } from "@peated/server/db/schema";
import { OSMSchema } from "@peated/server/lib/osm";
import axios from "axios";
import { eq } from "drizzle-orm";

export default async ({ regionId }: { regionId: number }) => {
  const region = await db.query.regions.findFirst({
    where: (regions, { eq }) => eq(regions.id, regionId),
    with: {
      country: true,
    },
  });
  if (!region) {
    throw new Error(`Unknown region: ${regionId}`);
  }

  // add  to get shape
  const { data } = await axios.get(
    `https://nominatim.openstreetmap.org/search.php?q=${encodeURIComponent(`${region.name}, ${region.country.name}`)}&format=geojson`,
    {
      headers: {
        "User-Agent": BOT_USER_AGENT,
      },
    },
  );

  const parsed = OSMSchema.parse(data);

  const match = parsed.features.find(
    (f) =>
      (f.properties.addresstype === "country" ||
        f.properties.addresstype === "province" ||
        f.properties.addresstype === "state" ||
        f.properties.addresstype === "county") &&
      f.properties.type === "administrative" &&
      f.properties.importance > 0.5,
  );

  if (!match) {
    throw new Error(
      `Failed to geocode region (no valid matches): ${region.id}}`,
    );
  }

  const updates: Partial<Country> = {
    // we expect lat, lng, but geojson is lng, lat seemingly
    location: [match.geometry.coordinates[1], match.geometry.coordinates[0]],
  };

  await db.update(regions).set(updates).where(eq(regions.id, region.id));
};
