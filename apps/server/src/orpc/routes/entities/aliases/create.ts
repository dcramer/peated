import { normalizeEntityName } from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import type { EntityAlias } from "@peated/server/db/schema";
import { changes, entities, entityAliases } from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { logError } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { pushUniqueJob } from "@peated/server/worker/client";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

const OutputSchema = z.object({
  name: z.string(),
  isCanonical: z.boolean(),
  createdAt: z.string(),
});

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/entities/{entity}/aliases",
    summary: "Create entity alias",
    description:
      "Add an alias to an entity. Requires moderator privileges and refuses aliases already owned by another entity.",
    operationId: "createEntityAlias",
  })
  .input(
    z.object({
      entity: z.coerce.number(),
      name: z.string().trim().min(1),
    }),
  )
  .output(OutputSchema)
  .handler(async function ({ input, context, errors }) {
    const aliasName = normalizeEntityName(input.name).trim();
    if (!aliasName) {
      throw errors.BAD_REQUEST({
        message: "Alias name is required.",
      });
    }

    const [entity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, input.entity));

    if (!entity) {
      throw errors.NOT_FOUND({
        message: "Entity not found.",
      });
    }

    const lowerAliasName = aliasName.toLowerCase();

    const alias = await db.transaction(async (tx) => {
      const actorId = (await getUserActorForDatabase(tx, context.user)).id;
      const existingAlias = await tx.query.entityAliases.findFirst({
        where: eq(sql`LOWER(${entityAliases.name})`, lowerAliasName),
      });

      if (existingAlias?.entityId === entity.id) {
        return existingAlias;
      }

      if (existingAlias?.entityId) {
        throw errors.CONFLICT({
          message: `Alias already belongs to another entity (${existingAlias.entityId}).`,
        });
      }

      let nextAlias: EntityAlias | undefined;
      if (existingAlias) {
        [nextAlias] = await tx
          .update(entityAliases)
          .set({
            name: aliasName,
            entityId: entity.id,
          })
          .where(
            and(
              eq(sql`LOWER(${entityAliases.name})`, lowerAliasName),
              isNull(entityAliases.entityId),
            ),
          )
          .returning();
      } else {
        [nextAlias] = await tx
          .insert(entityAliases)
          .values({
            name: aliasName,
            entityId: entity.id,
          })
          .onConflictDoNothing()
          .returning();
      }

      if (!nextAlias) {
        throw errors.CONFLICT({
          message: "Alias already exists.",
        });
      }

      await tx.insert(changes).values({
        objectType: "entity",
        objectId: entity.id,
        displayName: entity.name,
        createdById: context.user.id,
        actorId,
        type: "update",
        data: {
          alias: aliasName,
        },
      });

      return nextAlias;
    });

    try {
      await pushUniqueJob("IndexEntitySearchVectors", {
        entityId: entity.id,
      });
    } catch (err) {
      logError(err, {
        entity: {
          id: entity.id,
        },
      });
    }

    return {
      name: alias.name,
      isCanonical: alias.name.toLowerCase() === entity.name.toLowerCase(),
      createdAt: alias.createdAt.toISOString(),
    };
  });
