import { Client } from "@googlemaps/google-maps-services-js";
import { eq } from "drizzle-orm";
import config from "../../config";
import { DEFAULT_CREATED_BY_ID } from "../../constants";
import { db } from "../../db";
import { changes, entities, type Entity } from "../../db/schema";

export default async ({ entityId }: { entityId: number }) => {
  if (!config.GOOGLE_MAPS_API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  }

  const entity = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, entityId),
  });
  if (!entity) {
    throw new Error(`Unknown entity: ${entityId}`);
  }

  // short circuit if its already bound - we should unset this before
  // running if we want to re-run
  if (entity.location) {
    return;
  }

  if (!entity.address || !entity.country) return null;

  const client = new Client();

  const query = `${entity.address}, ${entity.region ? entity.country + "," : ""} ${entity.country}`;
  const result = await client.geocode({
    params: {
      key: config.GOOGLE_MAPS_API_KEY,
      address: query,
    },
  });

  if (result.data.status != "OK" || !result.data.results.length) {
    throw new Error(`Failed to geocode entity: ${entityId} (${query})`);
  }

  const match = result.data.results[0];

  console.log(
    `Updating location for Entity ${entity.id}: ${match.formatted_address} - ${match.geometry.location.lat}, ${match.geometry.location.lng}`,
  );

  const data: Partial<Entity> = {
    address: match.formatted_address,
    location: [match.geometry.location.lat, match.geometry.location.lng],
  };

  await db.transaction(async (tx) => {
    await tx.update(entities).set(data).where(eq(entities.id, entity.id));

    await tx.insert(changes).values({
      objectType: "entity",
      objectId: entity.id,
      displayName: entity.name,
      createdById: DEFAULT_CREATED_BY_ID,
      type: "update",
      data,
    });
  });
};
