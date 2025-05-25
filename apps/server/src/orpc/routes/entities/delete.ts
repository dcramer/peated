import { db } from "@peated/server/db";
import {
  changes,
  entities,
  entityAliases,
  entityTombstones,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({ method: "DELETE", path: "/entities/:entity" })
  .input(z.object({ entity: z.coerce.number() }))
  .output(z.object({}))
  .handler(async function ({ input, context, errors }) {
    const [entity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, input.entity))
      .limit(1);
    if (!entity) {
      throw errors.NOT_FOUND({
        message: "Entity not found.",
      });
    }

    await db.transaction(async (tx) => {
      await Promise.all([
        tx.insert(changes).values({
          objectType: "entity",
          objectId: entity.id,
          createdById: context.user.id,
          displayName: entity.name,
          type: "delete",
          data: {
            ...entity,
          },
        }),

        tx.delete(entityAliases).where(eq(entityAliases.entityId, entity.id)),

        tx.insert(entityTombstones).values({
          entityId: entity.id,
        }),
      ]);

      await tx.delete(entities).where(eq(entities.id, entity.id));
    });

    return {};
  });
