import { db } from "@peated/server/db";
import type { Entity } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottles,
  changes,
  countries,
  entities,
  entityAliases,
  regions,
} from "@peated/server/db/schema";
import { arraysEqual } from "@peated/server/lib/equals";
import { logError } from "@peated/server/lib/log";
import { normalizeEntityName } from "@peated/server/lib/normalize";
import { EntityInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { pushUniqueJob } from "@peated/server/worker/client";
import { TRPCError } from "@trpc/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { modProcedure } from "..";

export default modProcedure
  .input(
    EntityInputSchema.partial().extend({
      entity: z.number(),
    }),
  )
  .mutation(async function ({ input, ctx }) {
    const [entity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, input.entity));

    if (!entity) {
      throw new TRPCError({
        message: "Entity not found.",
        code: "NOT_FOUND",
      });
    }

    const data: { [name: string]: any } = {};

    if (input.name && input.name !== entity.name) {
      data.name = normalizeEntityName(input.name);
    }
    if (input.shortName !== undefined && input.shortName !== entity.shortName) {
      data.shortName = input.shortName;
    }

    if (input.parent !== undefined && input.parent !== entity.parentId) {
      // Check for circular reference
      let parentId = input.parent;
      while (parentId) {
        const [parent] = await db
          .select()
          .from(entities)
          .where(eq(entities.id, parentId));
        if (!parent) break;
        if (parent.id === entity.id) {
          throw new TRPCError({
            message: "Cannot create circular reference in entity hierarchy.",
            code: "BAD_REQUEST",
          });
        }
        parentId = parent.parentId;
      }
      data.parentId = input.parent;
    }

    if (input.country) {
      const [country] = await db
        .select()
        .from(countries)
        .where(eq(countries.id, input.country))
        .limit(1);
      if (!country) {
        throw new TRPCError({
          message: "Country not found.",
          code: "NOT_FOUND",
        });
      }
      if (country.id !== entity.countryId) {
        data.countryId = country.id;
        data.regionId = null;
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
        throw new TRPCError({
          message: "Region not found.",
          code: "NOT_FOUND",
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
      return await serialize(EntitySerializer, entity, ctx.user);
    }

    const user = ctx.user;
    const newEntity = await db.transaction(async (tx) => {
      let newEntity: Entity | undefined;

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
          throw new TRPCError({
            message: "Entity with name already exists.",
            code: "CONFLICT",
            cause: err,
          });
        }
        throw err;
      }
      if (!newEntity) return;

      if (data.name) {
        const newAliases = [data.name];
        if (data.name.startsWith("The ")) {
          newAliases.push(data.name.substring(4));
        }

        for (const aliasName of newAliases) {
          const existingAlias = await tx.query.entityAliases.findFirst({
            where: eq(
              sql`LOWER(${entityAliases.name})`,
              aliasName.toLowerCase(),
            ),
          });

          if (existingAlias?.entityId === newEntity.id) {
            if (existingAlias.name !== aliasName) {
              // case change
              await tx
                .update(entityAliases)
                .set({ name: aliasName })
                .where(
                  eq(
                    sql`LOWER(${entityAliases.name})`,
                    existingAlias.name.toLowerCase(),
                  ),
                );
            }
            // we're good - likely renaming to an alias that already existed
          } else if (!existingAlias) {
            await tx.insert(entityAliases).values({
              name: aliasName,
              entityId: newEntity.id,
              createdAt: newEntity.createdAt,
            });
          } else if (!existingAlias.entityId) {
            await tx
              .update(entityAliases)
              .set({
                entityId: newEntity.id,
              })
              .where(
                eq(
                  sql`LOWER(${entityAliases.name})`,
                  existingAlias.name.toLowerCase(),
                ),
              );
          } else {
            throw new Error(
              `Duplicate alias found (${existingAlias.entityId}). Not implemented.`,
            );
          }
        }
      }

      if (data.name || data.shortName) {
        await tx
          .update(bottles)
          .set({
            fullName: sql`${newEntity.shortName || newEntity.name} || ' ' || ${
              bottles.name
            }`,
          })
          .where(
            and(
              eq(bottles.brandId, newEntity.id),
              ne(
                bottles.fullName,
                sql`${newEntity.shortName || newEntity.name} || ' ' || ${
                  bottles.name
                }`,
              ),
            ),
          );

        // we do insert vs update to handle the ON CONFLICT scenario
        await tx.execute(sql`
            INSERT INTO ${bottleAliases} (name, bottle_id)
            SELECT ${bottles.fullName}, ${bottles.id} FROM ${bottles}
            WHERE ${bottles.brandId} = ${newEntity.id}
            ON CONFLICT (LOWER(name))
            DO UPDATE SET bottle_id = excluded.bottle_id WHERE ${bottleAliases.bottleId} IS NULL
        `);

        await tx.execute(sql`
            DELETE FROM ${bottleAliases}
            WHERE ${bottleAliases.bottleId} IN (
              SELECT ${bottles.id} FROM ${bottles}
               WHERE ${bottles.brandId} = ${newEntity.id}
                 AND LOWER(${bottleAliases.name}) = LOWER(${entity.name} || ' ' || ${bottles.name})
            )
        `);
      }

      await tx.insert(changes).values({
        objectType: "entity",
        objectId: newEntity.id,
        displayName: newEntity.name,
        createdById: user.id,
        type: "update",
        data: {
          ...data,
        },
      });

      return newEntity;
    });

    if (!newEntity) {
      throw new TRPCError({
        message: "Failed to update entity.",
        code: "INTERNAL_SERVER_ERROR",
      });
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

    return await serialize(EntitySerializer, newEntity, ctx.user);
  });
