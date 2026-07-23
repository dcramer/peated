import { normalizeEntityName } from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import type { Entity } from "@peated/server/db/schema";
import {
  bottleGroups,
  bottles,
  changes,
  countries,
  entities,
  regions,
} from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import {
  assignBottleAliasInTransaction,
  DuplicateBottleAliasError,
  ExactBottleAliasConflictError,
  finalizeBottleAliasAssignment,
  ReleaseOwnedBottleAliasError,
  type BottleAliasAssignmentResult,
} from "@peated/server/lib/bottleAliases";
import {
  DuplicateEntityAliasError,
  upsertEntityAliases,
} from "@peated/server/lib/db";
import { arraysEqual } from "@peated/server/lib/equals";
import { formatBottleName } from "@peated/server/lib/format";
import { logError } from "@peated/server/lib/log";
import {
  ConcreteBottleUpdateConflictError,
  ConcreteBottleUpdateGraphError,
  ConcreteBottleUpdateInputError,
  finalizeConcreteBottleUpdate,
  updateConcreteBottleInTransaction,
  type ConcreteBottleUpdateFinalizationManifest,
} from "@peated/server/lib/updateConcreteBottle";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { EntityInputSchema, EntitySchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { pushUniqueJob } from "@peated/server/worker/client";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z.object({
  entity: z.number(),
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

class BottleGroupRepresentativeMissingError extends Error {
  constructor(readonly groupId: number) {
    super(`BottleGroup ${groupId} has no representative Bottle.`);
    this.name = "BottleGroupRepresentativeMissingError";
  }
}

export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/entities/{entity}",
    summary: "Update entity",
    description:
      "Update entity information including name, location, type, and description. Automatically updates related bottles and aliases. Requires moderator privileges",
    operationId: "updateEntity",
  })
  .input(InputSchema)
  .output(EntitySchema)
  .handler(async function ({ input, context, errors }) {
    const [entity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, input.entity));

    if (!entity) {
      throw errors.NOT_FOUND({
        message: "Entity not found.",
      });
    }

    const data: { [name: string]: any } = {};

    if (input.name && input.name !== entity.name) {
      data.name = normalizeEntityName(input.name);
    }
    if (input.shortName !== undefined && input.shortName !== entity.shortName) {
      data.shortName = input.shortName;
    }

    if (input.country) {
      if (input.country) {
        const [country] = await db
          .select()
          .from(countries)
          .where(eq(countries.id, input.country))
          .limit(1);
        if (!country) {
          throw errors.NOT_FOUND({
            message: "Country not found.",
          });
        }
        if (country.id !== entity.countryId) {
          data.countryId = country.id;
          data.regionId = null;
        }
      }
    } else if (input.country === null) {
      if (entity.countryId) {
        data.countryId = null;
        data.regionId = null;
      }
    }

    if (input.region) {
      const [region] = await db
        .select()
        .from(regions)
        .where(eq(regions.id, input.region))
        .limit(1);
      if (
        !region ||
        region.countryId !== (data.countryId ?? entity.countryId)
      ) {
        throw errors.NOT_FOUND({
          message: "Region not found.",
        });
      }
      if (region.id !== entity.regionId) {
        data.regionId = region.id;
      }
    } else if (input.region === null) {
      if (entity.regionId) {
        data.regionId = null;
      }
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
    if (Object.values(data).length === 0) {
      return await serialize(EntitySerializer, entity, context.user);
    }

    const user = context.user;
    let updateResult: {
      entity: Entity | undefined;
      bottleUpdates: ConcreteBottleUpdateFinalizationManifest[];
      legacyAliasAssignments: BottleAliasAssignmentResult[];
      changedLegacyBottleIds: number[];
    };
    try {
      updateResult = await db.transaction(async (tx) => {
        const actorId = (await getUserActorForDatabase(tx, user)).id;
        let newEntity: Entity | undefined;
        const bottleUpdates: ConcreteBottleUpdateFinalizationManifest[] = [];
        const legacyAliasAssignments: BottleAliasAssignmentResult[] = [];
        const changedLegacyBottleIds: number[] = [];

        try {
          [newEntity] = await tx
            .update(entities)
            .set({
              ...data,
              updatedAt: sql`NOW()`,
            })
            .where(eq(entities.id, entity.id))
            .returning();
        } catch (err: any) {
          if (err?.code === "23505" && err?.constraint === "entity_name_unq") {
            throw errors.CONFLICT({
              message: "Entity with name already exists.",
              cause: err,
            });
          }
          throw err;
        }
        if (!newEntity) {
          return {
            entity: undefined,
            bottleUpdates,
            legacyAliasAssignments,
            changedLegacyBottleIds,
          };
        }

        if (data.name || data.shortName !== undefined) {
          try {
            await upsertEntityAliases({
              db: tx,
              entity: newEntity,
              previousEntity: entity,
            });
          } catch (err) {
            if (err instanceof DuplicateEntityAliasError) {
              throw errors.CONFLICT({
                message: err.message,
                cause: err,
              });
            }
            throw err;
          }
        }

        if (data.name || data.shortName !== undefined) {
          const groups = await tx
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
              await updateConcreteBottleInTransaction(tx, {
                bottleId: group.representativeBottleId,
                input: { shared: { brand: newEntity.id } },
                user,
                actorId,
                creationSource: "manual_entry",
              }),
            );
          }

          const legacyBottles = await tx
            .select()
            .from(bottles)
            .where(
              and(eq(bottles.brandId, newEntity.id), isNull(bottles.groupId)),
            )
            .orderBy(asc(bottles.id))
            .for("update");

          for (const bottle of legacyBottles) {
            const nextFullName = formatBottleName({
              ...bottle,
              name: `${newEntity.shortName || newEntity.name} ${bottle.name}`,
            });
            for (const aliasName of new Set([bottle.fullName, nextFullName])) {
              legacyAliasAssignments.push(
                await assignBottleAliasInTransaction(tx, {
                  bottleId: bottle.id,
                  releaseId: null,
                  aliasReleaseId: null,
                  name: aliasName,
                  assignmentSource: "legacy",
                  assignedByActorId: actorId,
                  rejectReleaseOwnedAlias: true,
                  context: {
                    caller: "entities.update",
                    operation: "renameUngroupedBrandBottle",
                  },
                }),
              );
            }
            if (bottle.fullName !== nextFullName) {
              await tx
                .update(bottles)
                .set({ fullName: nextFullName, updatedAt: new Date() })
                .where(and(eq(bottles.id, bottle.id), isNull(bottles.groupId)));
              changedLegacyBottleIds.push(bottle.id);
            }
          }
        }

        await tx.insert(changes).values({
          objectType: "entity",
          objectId: newEntity.id,
          displayName: newEntity.name,
          actorId,
          type: "update",
          data: {
            ...data,
          },
        });

        return {
          entity: newEntity,
          bottleUpdates,
          legacyAliasAssignments,
          changedLegacyBottleIds,
        };
      });
    } catch (error) {
      if (
        error instanceof ConcreteBottleUpdateConflictError ||
        error instanceof ConcreteBottleUpdateGraphError ||
        error instanceof ConcreteBottleUpdateInputError ||
        error instanceof ExactBottleAliasConflictError ||
        error instanceof DuplicateBottleAliasError ||
        error instanceof ReleaseOwnedBottleAliasError ||
        error instanceof BottleGroupRepresentativeMissingError
      ) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }

    const newEntity = updateResult.entity;
    if (!newEntity) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to update entity.",
      });
    }

    for (const bottleUpdate of updateResult.bottleUpdates) {
      await finalizeConcreteBottleUpdate(bottleUpdate);
    }
    for (const aliasAssignment of updateResult.legacyAliasAssignments) {
      await finalizeBottleAliasAssignment(aliasAssignment, {
        entity: { id: newEntity.id },
      });
    }
    for (const bottleId of updateResult.changedLegacyBottleIds) {
      try {
        await pushUniqueJob(
          "IndexBottleSearchVectors",
          { bottleId },
          { delay: 5000 },
        );
      } catch (err) {
        logError(err, { bottle: { id: bottleId } });
      }
    }

    try {
      await pushUniqueJob(
        "OnEntityChange",
        { entityId: entity.id },
        { delay: 5000 },
      );
    } catch (err) {
      logError(err, {
        entity: {
          id: entity.id,
        },
      });
    }

    return await serialize(EntitySerializer, newEntity, context.user);
  });
