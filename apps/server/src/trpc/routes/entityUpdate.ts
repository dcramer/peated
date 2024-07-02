import { db } from "@peated/server/db";
import type { Entity } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottles,
  changes,
  countries,
  entities,
  entityAliases,
} from "@peated/server/db/schema";
import { arraysEqual } from "@peated/server/lib/equals";
import { logError } from "@peated/server/lib/log";
import { normalizeEntityName } from "@peated/server/lib/normalize";
import { EntityInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { pushJob } from "@peated/server/worker/client";
import { TRPCError } from "@trpc/server";
import { and, eq, ilike, ne, sql } from "drizzle-orm";
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
    if (input.country !== undefined && input.country) {
      const [country] = await db
        .select()
        .from(countries)
        .where(eq(sql`LOWER(${countries.name})`, input.country.toLowerCase()))
        .limit(1);
      if (!country) {
        throw new TRPCError({
          message: "Country not found.",
          code: "NOT_FOUND",
        });
      }
      if (country.id !== entity.countryId) {
        data.countryId = country.id;
      }
    }
    if (input.region !== undefined && input.region !== entity.region) {
      data.region = input.region;
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
          .set(data)
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

        for (const newAlias of newAliases) {
          const existingAlias = await tx.query.entityAliases.findFirst({
            where: ilike(entityAliases.name, newAlias),
          });

          if (existingAlias?.entityId === newEntity.id) {
            // we're good - likely renaming to an alias that already existed
          } else if (!existingAlias) {
            await tx.insert(entityAliases).values({
              name: newAlias,
              entityId: newEntity.id,
            });
          } else if (!existingAlias.entityId) {
            await tx
              .update(entityAliases)
              .set({
                entityId: newEntity.id,
              })
              .where(and(eq(entityAliases.name, newAlias)));
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
        await tx.execute(sql`
          UPDATE ${bottleAliases}
          SET "name" = ${bottles.fullName}
          FROM ${bottles}
          WHERE ${bottles.id} = ${bottleAliases.bottleId}
            AND ${bottles.brandId} = ${newEntity.id}
            AND ${bottleAliases.name} = ${entity.name} || ' ' || ${bottles.name}`);
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
      await pushJob("OnEntityChange", { entityId: entity.id });
    } catch (err) {
      logError(err, {
        entity: {
          id: entity.id,
        },
      });
    }

    return await serialize(EntitySerializer, newEntity, ctx.user);
  });
