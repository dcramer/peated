import { db } from "@peated/server/db";
import { type SerializedPoint } from "@peated/server/db/columns";
import type { Entity } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottles,
  changes,
  entities,
  entityAliases,
} from "@peated/server/db/schema";
import { pushJob } from "@peated/server/jobs/client";
import { arraysEqual } from "@peated/server/lib/equals";
import { logError } from "@peated/server/lib/log";
import { EntityInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { TRPCError } from "@trpc/server";
import { and, eq, getTableColumns, ilike, ne, sql } from "drizzle-orm";
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
      data.name = input.name;
    }
    if (input.shortName !== undefined && input.shortName !== entity.shortName) {
      data.shortName = input.shortName;
    }
    if (input.country !== undefined && input.country !== entity.country) {
      data.country = input.country;
    }
    if (input.region !== undefined && input.region !== entity.region) {
      data.region = input.region;
    }
    if (input.type !== undefined && !arraysEqual(input.type, entity.type)) {
      data.type = input.type;
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
      let newEntity:
        | (Entity & {
            location: SerializedPoint;
          })
        | undefined;
      try {
        [newEntity] = await tx
          .update(entities)
          .set(data)
          .where(eq(entities.id, entity.id))
          .returning({
            ...getTableColumns(entities),
            location: sql<SerializedPoint>`ST_AsGeoJSON(${entities.location}) as location`,
          });
      } catch (err: any) {
        if (err?.code === "23505" && err?.constraint === "entity_name_unq") {
          throw new TRPCError({
            message: "Entity with name already exists.",
            code: "CONFLICT",
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

    if (newEntity.name !== entity.name || !newEntity.description) {
      try {
        await pushJob("GenerateEntityDetails", { entityId: entity.id });
      } catch (err) {
        logError(err, {
          entity: {
            id: entity.id,
          },
        });
      }
    }

    return await serialize(EntitySerializer, newEntity, ctx.user);
  });
