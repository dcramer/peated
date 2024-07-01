import { Client, PlaceType2 } from "@googlemaps/google-maps-services-js";
import { eq } from "drizzle-orm";
import config from "../../config";
import { db } from "../../db";
import type { Country} from "../../db/schema";
import { countries } from "../../db/schema";

export default async ({ countryId }: { countryId: number }) => {
  if (!config.GOOGLE_MAPS_API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  }

  const country = await db.query.countries.findFirst({
    where: (countries, { eq }) => eq(countries.id, countryId),
  });
  if (!country) {
    throw new Error(`Unknown country: ${countryId}`);
  }

  const client = new Client();

  const result = await client.geocode({
    params: {
      key: config.GOOGLE_MAPS_API_KEY,
      address: country.name,
    },
  });

  if (result.data.status != "OK" || !result.data.results.length) {
    throw new Error(`Failed to geocode country: ${country.slug}`);
  }

  const match = result.data.results[0];
  if (match.types.indexOf(PlaceType2.country) !== -1) {
    throw new Error(
      `Failed to geocode country (invalid match type): ${country.slug} - ${match.types.join(", ")}`,
    );
  }

  const data: Partial<Country> = {
    location: [match.geometry.location.lat, match.geometry.location.lng],
  };

  await db.update(countries).set(data).where(eq(countries.id, country.id));
};
