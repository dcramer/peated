import { normalizeEntityName } from "@peated/bottle-classifier/normalize";
import { buildCatalogVerificationCreationMetadata } from "@peated/catalog-verifier";
import { db } from "@peated/server/db";
import type { EntityKind, NewEntity, User } from "@peated/server/db/schema";
import {
  changes,
  countries,
  entities,
  regions,
} from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { queueEntityCreationVerification } from "@peated/server/lib/catalogVerification";
import {
  DuplicateEntityAliasError,
  upsertEntityAliases,
} from "@peated/server/lib/db";
import { logError } from "@peated/server/lib/log";
import { buildEntitySearchVector } from "@peated/server/lib/search";
import type { EntityKindCreateInputSchema } from "@peated/server/orpc/contracts/entityKinds/create";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { pushJob } from "@peated/server/worker/client";
import { eq, sql } from "drizzle-orm";
import type { z } from "zod";

type ErrorFactory = (options: { message: string; cause?: unknown }) => Error;

export async function createEntityKind({
  currentUser,
  errors,
  input,
  kind,
}: {
  currentUser: User;
  errors: {
    CONFLICT: ErrorFactory;
    INTERNAL_SERVER_ERROR: ErrorFactory;
    NOT_FOUND: ErrorFactory;
  };
  input: z.infer<typeof EntityKindCreateInputSchema>;
  kind: EntityKind;
}) {
  const data: Omit<NewEntity, "createdByActorId"> = {
    ...input,
    kind,
    name: normalizeEntityName(input.name),
  };

  if (input.country) {
    const [country] = await db
      .select()
      .from(countries)
      .where(eq(countries.id, input.country))
      .limit(1);
    if (!country) throw errors.NOT_FOUND({ message: "Country not found." });
    data.countryId = country.id;

    if (input.region) {
      const [region] = await db
        .select()
        .from(regions)
        .where(eq(regions.id, input.region))
        .limit(1);
      if (!region || region.countryId !== data.countryId) {
        throw errors.NOT_FOUND({ message: "Region not found." });
      }
      data.regionId = region.id;
    }
  }

  if (data.description) {
    data.descriptionSrc = input.descriptionSrc || "user";
  }

  const result = await db.transaction(async (tx) => {
    if (data.ownerId !== null && data.ownerId !== undefined) {
      const owner = await tx.query.entities.findFirst({
        where: eq(entities.id, data.ownerId),
        columns: { id: true },
      });
      if (!owner) throw errors.NOT_FOUND({ message: "Owner not found." });
    }

    const actorId = (await getUserActorForDatabase(tx, currentUser)).id;
    const entityData: NewEntity = { ...data, createdByActorId: actorId };
    const [entity] = await tx
      .insert(entities)
      .values({
        ...entityData,
        searchVector: buildEntitySearchVector(entityData),
      })
      .onConflictDoNothing()
      .returning();

    if (!entity) {
      const [existing] = await tx
        .select()
        .from(entities)
        .where(eq(sql`LOWER(${entities.name})`, data.name.toLowerCase()));
      if (existing?.kind === kind) return { entity: existing, created: false };
      throw errors.CONFLICT({
        message: "Entity with name already exists under another kind.",
      });
    }

    try {
      await upsertEntityAliases({ db: tx, entity });
    } catch (err) {
      if (err instanceof DuplicateEntityAliasError) {
        throw errors.CONFLICT({ message: err.message, cause: err });
      }
      throw err;
    }

    await tx.insert(changes).values({
      objectType: "entity",
      objectId: entity.id,
      displayName: entity.name,
      type: "add",
      createdAt: entity.createdAt,
      actorId,
      data: {
        ...data,
        catalogVerification:
          buildCatalogVerificationCreationMetadata("manual_entry"),
      },
    });
    return { entity, created: true };
  });

  if (!result?.entity) {
    throw errors.INTERNAL_SERVER_ERROR({ message: "Failed to create Entity." });
  }

  if (result.created) {
    try {
      await pushJob("OnEntityChange", { entityId: result.entity.id });
    } catch (err) {
      logError(err, { entity: { id: result.entity.id } });
    }

    try {
      await queueEntityCreationVerification({
        entityId: result.entity.id,
        creationSource: "manual_entry",
      });
    } catch (err) {
      logError(err, { entity: { id: result.entity.id } });
    }
  }

  return await serialize(EntitySerializer, result.entity, currentUser);
}
