import { normalizeEntityName } from "@peated/bottle-classifier/normalize";
import { db, type AnyTransaction } from "@peated/server/db";
import type { Entity, User } from "@peated/server/db/schema";
import {
  bottleGroups,
  changes,
  countries,
  entities,
  regions,
} from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { ExactBottleAliasConflictError } from "@peated/server/lib/bottleAliases";
import {
  DuplicateEntityAliasError,
  upsertEntityAliases,
} from "@peated/server/lib/db";
import { arraysEqual } from "@peated/server/lib/equals";
import { logError } from "@peated/server/lib/log";
import {
  BottleUpdateConflictError,
  BottleUpdateGraphError,
  BottleUpdateInputError,
  finalizeBottleUpdate,
  updateBottleInTransaction,
  type BottleUpdateFinalizationManifest,
} from "@peated/server/lib/updateBottle";
import { EntityInputSchema } from "@peated/server/schemas";
import { pushUniqueJob } from "@peated/server/worker/client";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

export const EntityUpdateInputSchema = z.object({
  name: EntityInputSchema.shape.name.optional(),
  shortName: EntityInputSchema.shape.shortName.removeDefault().optional(),
  type: EntityInputSchema.shape.type.removeDefault().optional(),
  description: EntityInputSchema.shape.description.removeDefault().optional(),
  descriptionSrc: EntityInputSchema.shape.descriptionSrc.optional(),
  yearEstablished: EntityInputSchema.shape.yearEstablished
    .removeDefault()
    .optional(),
  website: EntityInputSchema.shape.website.removeDefault().optional(),
  country: EntityInputSchema.shape.country.removeDefault().optional(),
  region: EntityInputSchema.shape.region.removeDefault().optional(),
  address: EntityInputSchema.shape.address.removeDefault().optional(),
  location: EntityInputSchema.shape.location.removeDefault().optional(),
});

export type EntityUpdateInput = z.infer<typeof EntityUpdateInputSchema>;

export class EntityUpdateAuthorizationError extends Error {
  constructor() {
    super("Moderator authorization is required to update an Entity.");
    this.name = "EntityUpdateAuthorizationError";
  }
}

export class EntityUpdateNotFoundError extends Error {
  constructor(readonly resource: "Entity" | "Country" | "Region") {
    super(`${resource} not found.`);
    this.name = "EntityUpdateNotFoundError";
  }
}

export class EntityUpdateConflictError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "EntityUpdateConflictError";
  }
}

export class EntityUpdateFailedError extends Error {
  constructor(options?: ErrorOptions) {
    super("Failed to update entity.", options);
    this.name = "EntityUpdateFailedError";
  }
}

class BottleGroupRepresentativeMissingError extends Error {
  constructor(readonly groupId: number) {
    super(`BottleGroup ${groupId} has no representative Bottle.`);
    this.name = "BottleGroupRepresentativeMissingError";
  }
}

type EntityUpdateData = Partial<
  Pick<
    Entity,
    | "name"
    | "shortName"
    | "type"
    | "description"
    | "descriptionSrc"
    | "yearEstablished"
    | "website"
    | "countryId"
    | "regionId"
    | "address"
    | "location"
  >
>;

function isEntityNameConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === "entity_name_unq"
  );
}

export type EntityUpdateFinalizationManifest = {
  entity: Entity;
  changed: boolean;
  bottleUpdates: BottleUpdateFinalizationManifest[];
};

export type EntityUpdateExpectedState = {
  fields: {
    name?: string;
    shortName?: string | null;
    roles?: Entity["type"];
    website?: string | null;
    countryId?: number | null;
    regionId?: number | null;
    yearEstablished?: number | null;
  };
  referencedCountry: { id: number; name: string } | null;
  referencedRegion: { id: number; countryId: number; name: string } | null;
};

/**
 * Applies the durable part of an Entity update inside a caller-owned
 * transaction. Callers finalize queued side effects only after commit.
 */
export async function updateEntityInTransaction(
  transaction: AnyTransaction,
  {
    actorId,
    entityId,
    expectedState,
    input,
    user,
  }: {
    actorId: number;
    entityId: number;
    expectedState?: EntityUpdateExpectedState;
    input: EntityUpdateInput;
    user: User;
  },
): Promise<EntityUpdateFinalizationManifest> {
  const [entity] = await transaction
    .select()
    .from(entities)
    .where(eq(entities.id, entityId))
    .for("update");

  if (!entity) {
    throw new EntityUpdateNotFoundError("Entity");
  }
  if (expectedState) {
    const currentFields = {
      name: entity.name,
      shortName: entity.shortName,
      roles: [...entity.type].sort(),
      website: entity.website,
      countryId: entity.countryId,
      regionId: entity.regionId,
      yearEstablished: entity.yearEstablished,
    };
    if (
      Object.entries(expectedState.fields).some(
        ([field, expected]) =>
          JSON.stringify(currentFields[field as keyof typeof currentFields]) !==
          JSON.stringify(expected),
      )
    ) {
      throw new EntityUpdateConflictError(
        `Entity ${entityId} changed after operation preparation.`,
      );
    }
  }

  const data: EntityUpdateData = {};

  if (input.name && input.name !== entity.name) {
    data.name = normalizeEntityName(input.name);
  }
  if (input.shortName !== undefined && input.shortName !== entity.shortName) {
    data.shortName = input.shortName;
  }

  if (input.country) {
    const [country] = await transaction
      .select()
      .from(countries)
      .where(eq(countries.id, input.country))
      .limit(1)
      .for("share");
    if (!country) {
      throw new EntityUpdateNotFoundError("Country");
    }
    if (
      expectedState?.referencedCountry &&
      (country.id !== expectedState.referencedCountry.id ||
        country.name !== expectedState.referencedCountry.name)
    ) {
      throw new EntityUpdateConflictError(
        `Country ${country.id} changed after operation preparation.`,
      );
    }
    if (country.id !== entity.countryId) {
      data.countryId = country.id;
      data.regionId = null;
    }
  } else if (input.country === null && entity.countryId) {
    data.countryId = null;
    data.regionId = null;
  }

  if (input.region) {
    const [region] = await transaction
      .select()
      .from(regions)
      .where(eq(regions.id, input.region))
      .limit(1)
      .for("share");
    if (!region || region.countryId !== (data.countryId ?? entity.countryId)) {
      throw new EntityUpdateNotFoundError("Region");
    }
    if (
      expectedState?.referencedRegion &&
      (region.id !== expectedState.referencedRegion.id ||
        region.countryId !== expectedState.referencedRegion.countryId ||
        region.name !== expectedState.referencedRegion.name)
    ) {
      throw new EntityUpdateConflictError(
        `Region ${region.id} changed after operation preparation.`,
      );
    }
    if (region.id !== entity.regionId) {
      data.regionId = region.id;
    }
  } else if (input.region === null && entity.regionId) {
    data.regionId = null;
  }

  if (input.address !== undefined && input.address !== entity.address) {
    data.address = input.address;
    data.location = null;
  }

  if (
    input.location !== undefined &&
    (!input.location ||
      !entity.location ||
      !arraysEqual(input.location, entity.location))
  ) {
    data.location = input.location;
  }

  if (input.type !== undefined && !arraysEqual(input.type, entity.type)) {
    data.type = input.type;
  }
  if (
    input.description !== undefined &&
    input.description !== entity.description
  ) {
    data.description = input.description;
    data.descriptionSrc =
      input.descriptionSrc ||
      (input.description && input.description !== null ? "user" : null);
  }
  if (
    input.yearEstablished !== undefined &&
    input.yearEstablished !== entity.yearEstablished
  ) {
    data.yearEstablished = input.yearEstablished;
  }
  if (input.website !== undefined && input.website !== entity.website) {
    data.website = input.website;
  }

  if (Object.keys(data).length === 0) {
    return { entity, changed: false, bottleUpdates: [] };
  }

  let newEntity: Entity | undefined;
  const bottleUpdates: BottleUpdateFinalizationManifest[] = [];
  try {
    [newEntity] = await transaction
      .update(entities)
      .set({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .where(eq(entities.id, entity.id))
      .returning();
  } catch (error) {
    if (isEntityNameConflict(error)) {
      throw new EntityUpdateConflictError("Entity with name already exists.", {
        cause: error,
      });
    }
    throw error;
  }
  if (!newEntity) {
    throw new EntityUpdateFailedError();
  }

  try {
    if (data.name || data.shortName !== undefined) {
      try {
        await upsertEntityAliases({
          db: transaction,
          entity: newEntity,
          previousEntity: entity,
        });
      } catch (error) {
        if (error instanceof DuplicateEntityAliasError) {
          throw new EntityUpdateConflictError(error.message, {
            cause: error,
          });
        }
        throw error;
      }

      const groups = await transaction
        .select({
          id: bottleGroups.id,
          representativeBottleId: bottleGroups.representativeBottleId,
        })
        .from(bottleGroups)
        .where(eq(bottleGroups.brandId, newEntity.id))
        .orderBy(asc(bottleGroups.id))
        .for("update");

      for (const group of groups) {
        if (group.representativeBottleId === null) {
          throw new BottleGroupRepresentativeMissingError(group.id);
        }
        bottleUpdates.push(
          await updateBottleInTransaction(transaction, {
            bottleId: group.representativeBottleId,
            input: { brand: newEntity.id },
            actorId,
            creationSource: "manual_entry",
          }),
        );
      }
    }

    await transaction.insert(changes).values({
      objectType: "entity",
      objectId: newEntity.id,
      displayName: newEntity.name,
      actorId,
      type: "update",
      data,
    });
  } catch (error) {
    if (
      error instanceof BottleUpdateConflictError ||
      error instanceof BottleUpdateGraphError ||
      error instanceof BottleUpdateInputError ||
      error instanceof ExactBottleAliasConflictError ||
      error instanceof BottleGroupRepresentativeMissingError
    ) {
      throw new EntityUpdateConflictError(error.message, { cause: error });
    }
    throw error;
  }

  return { entity: newEntity, changed: true, bottleUpdates };
}

export async function finalizeEntityUpdate(
  result: EntityUpdateFinalizationManifest,
) {
  if (!result.changed) return;
  for (const bottleUpdate of result.bottleUpdates) {
    await finalizeBottleUpdate(bottleUpdate);
  }

  try {
    await pushUniqueJob(
      "OnEntityChange",
      { entityId: result.entity.id },
      { delay: 5000 },
    );
  } catch (error) {
    logError(error, {
      entity: {
        id: result.entity.id,
      },
    });
  }
}

/**
 * Applies the canonical moderator Entity update, including aliases, Brand
 * BottleGroup rematerialization, attribution, and post-commit indexing.
 */
export async function updateEntity({
  entityId,
  input: rawInput,
  user,
}: {
  entityId: number;
  input: unknown;
  user: User | null;
}): Promise<{ entity: Entity; changed: boolean }> {
  if (!user?.admin && !user?.mod) {
    throw new EntityUpdateAuthorizationError();
  }

  const input = EntityUpdateInputSchema.parse(rawInput);
  const result = await db.transaction(async (transaction) => {
    const actorId = (await getUserActorForDatabase(transaction, user)).id;
    return await updateEntityInTransaction(transaction, {
      actorId,
      entityId,
      input,
      user,
    });
  });
  await finalizeEntityUpdate(result);
  return { entity: result.entity, changed: result.changed };
}
