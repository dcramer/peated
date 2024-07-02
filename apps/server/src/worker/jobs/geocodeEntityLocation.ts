import { Client } from "@googlemaps/google-maps-services-js";
import config from "@peated/server/config";
import { DEFAULT_CREATED_BY_ID } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  changes,
  entities,
  type Country,
  type Entity,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";

async function locateAddress(entity: Entity & { country: Country | null }) {
  if (!config.GOOGLE_MAPS_API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  }

  if (!entity.country) {
    throw new Error("Need country");
  }

  const client = new Client();

  const result = await client.textSearch({
    params: {
      key: config.GOOGLE_MAPS_API_KEY,
      query: `${entity.name}, ${entity.country.name}`,
    },
  });

  if (result.data.status != "OK" || !result.data.results.length) {
    throw new Error(`Failed to identify address of Entity: ${entity.id}`);
  }

  return result;
}

async function geocodeAddress(entity: Entity & { country: Country | null }) {
  if (!config.GOOGLE_MAPS_API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  }

  if (!entity.country) {
    throw new Error("Need country");
  }

  const client = new Client();

  const query = `${entity.address}, ${entity.region ? entity.region + "," : ""} ${entity.country.name}`;
  const result = await client.geocode({
    params: {
      key: config.GOOGLE_MAPS_API_KEY,
      address: query,
    },
  });

  if (result.data.status != "OK" || !result.data.results.length) {
    throw new Error(`Failed to geocode address of Entity: ${entity.id}`);
  }

  return result;
}

export default async ({
  entityId,
  force = false,
}: {
  entityId: number;
  force?: boolean;
}) => {
  if (!config.GOOGLE_MAPS_API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  }

  const entity = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, entityId),
    with: {
      country: true,
    },
  });

  if (!entity) {
    throw new Error(`Unknown entity: ${entityId}`);
  }

  if (!entity.country) {
    // cant geocode if we dont know the country
    return;
  }

  if (entity.location && !force) {
    return;
  }

  // short circuit if its already bound - we should unset this before
  // running if we want to re-run
  const result = entity.address
    ? await geocodeAddress(entity)
    : await locateAddress(entity);

  const match = result.data.results[0];
  if (!match.formatted_address) {
    throw new Error("Unable to identify address");
  }
  if (!match.geometry) {
    throw new Error("Unable to identify geometry");
  }

  console.log(
    `Updating location for Entity ${entity.id}: ${match.formatted_address} (${match.geometry.location.lat}, ${match.geometry.location.lng})`,
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
