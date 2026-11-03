import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { changes, entities, type Entity } from "@peated/server/db/schema";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import { logInfo } from "@peated/server/lib/log";
import type { JobPayload } from "@peated/server/worker/types";
import axios from "axios";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const GeocodeEntityLocationJobArgsSchema = z
  .object({
    entityId: z.number().int().positive(),
    force: z.boolean().default(false),
  })
  .strict();

// Google Geocoding API response: https://developers.google.com/maps/documentation/geocoding/requests-geocoding
const GeocodeResponseSchema = z.object({
  status: z.string(),
  results: z.array(
    z.object({
      formatted_address: z.string(),
      geometry: z.object({
        location: z.object({ lat: z.number(), lng: z.number() }),
      }),
    }),
  ),
});

async function geocodeAddress(address: string, apiKey: string) {
  const { data } = await axios.get(
    "https://maps.googleapis.com/maps/api/geocode/json",
    { params: { key: apiKey, address } },
  );

  const result = GeocodeResponseSchema.parse(data);
  return result.status === "OK" ? (result.results[0] ?? null) : null;
}

export default async (input: JobPayload) => {
  const { entityId, force } = GeocodeEntityLocationJobArgsSchema.parse(input);

  if (!config.GOOGLE_MAPS_API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  }

  const entity = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, entityId),
    with: {
      country: true,
      region: true,
    },
  });

  if (!entity) return;

  if (!entity.country) {
    // cant geocode if we dont know the country
    return;
  }

  if (entity.location && !force) {
    return;
  }

  // since we have no way override this, lets short circuit for now
  // as sometimes we're getting wrong addresses
  if (!entity.address) {
    return;
  }

  const match = await geocodeAddress(
    `${entity.address}, ${entity.region ? entity.region.name + "," : ""} ${entity.country.name}`,
    config.GOOGLE_MAPS_API_KEY,
  );
  if (!match) {
    throw new Error(`Failed to geocode address of Entity: ${entity.id}`);
  }

  logInfo("Updating location for entity {entityId}", {
    extra: {
      entityId: entity.id,
      address: match.formatted_address,
      latitude: match.geometry.location.lat,
      longitude: match.geometry.location.lng,
    },
  });

  const data: Partial<Entity> = {
    address: match.formatted_address,
    location: [match.geometry.location.lng, match.geometry.location.lat],
  };
  const actor = await getPeatedSystemActor();

  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(entities)
      .set(data)
      .where(eq(entities.id, entity.id))
      .returning({ id: entities.id });
    if (!updated) return;

    await tx.insert(changes).values({
      objectType: "entity",
      objectId: entity.id,
      displayName: entity.name,
      actorId: actor.id,
      type: "update",
      data,
    });
  });
};
