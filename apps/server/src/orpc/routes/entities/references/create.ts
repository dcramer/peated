import { normalizeEntityName } from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import type { EntityReference } from "@peated/server/db/schema";
import { changes, entities, entityReferences } from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { pushUniqueJob } from "@peated/server/worker/client";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

const OutputSchema = z.object({
  name: z.string(),
  isEntityName: z.boolean(),
  createdAt: z.string(),
});

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/entities/{entity}/references",
    summary: "Add an Entity reference",
    description:
      "Add a name that can match input to this Entity. Requires a moderator.",
    operationId: "createEntityReference",
  })
  .input(
    z.object({
      entity: z.coerce.number().int().positive(),
      name: z.string().trim().min(1).max(255),
    }),
  )
  .output(OutputSchema)
  .handler(async ({ input, context, errors }) => {
    const referenceName = normalizeEntityName(input.name).trim();
    if (!referenceName) {
      throw errors.BAD_REQUEST({
        message: "Reference name is required.",
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

    const lowerReferenceName = referenceName.toLowerCase();

    const reference = await db.transaction(async (tx) => {
      const actorId = (await getUserActorForDatabase(tx, context.user)).id;
      const existingReference = await tx.query.entityReferences.findFirst({
        where: eq(sql`LOWER(${entityReferences.name})`, lowerReferenceName),
      });

      if (existingReference?.entityId === entity.id) {
        return existingReference;
      }

      if (existingReference?.entityId) {
        throw errors.CONFLICT({
          message: `This name belongs to Entity ${existingReference.entityId}.`,
        });
      }

      let nextReference: EntityReference | undefined;
      if (existingReference) {
        [nextReference] = await tx
          .update(entityReferences)
          .set({
            name: referenceName,
            entityId: entity.id,
          })
          .where(
            and(
              eq(sql`LOWER(${entityReferences.name})`, lowerReferenceName),
              isNull(entityReferences.entityId),
            ),
          )
          .returning();
      } else {
        [nextReference] = await tx
          .insert(entityReferences)
          .values({
            name: referenceName,
            entityId: entity.id,
          })
          .onConflictDoNothing()
          .returning();
      }

      if (!nextReference) {
        throw errors.CONFLICT({
          message: "Reference already exists.",
        });
      }

      await tx.insert(changes).values({
        objectType: "entity",
        objectId: entity.id,
        displayName: entity.name,
        actorId,
        type: "update",
        data: {
          reference: referenceName,
        },
      });

      return nextReference;
    });

    await pushUniqueJob("IndexEntitySearchVectors", {
      entityId: entity.id,
    });

    return {
      name: reference.name,
      isEntityName: reference.name.toLowerCase() === entity.name.toLowerCase(),
      createdAt: reference.createdAt.toISOString(),
    };
  });
