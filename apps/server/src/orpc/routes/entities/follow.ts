import { db } from "@peated/server/db";
import { entities, entityFollows } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "PUT",
    path: "/entities/{entity}/follow",
    summary: "Follow entity",
    description:
      "Follow a brand, distiller, or bottler. Requires authentication.",
    operationId: "followEntity",
  })
  .input(z.object({ entity: z.coerce.number() }).strict())
  .output(z.object({ following: z.literal(true) }))
  .handler(async function ({ input, context, errors }) {
    const [entity] = await db
      .select({ id: entities.id })
      .from(entities)
      .where(eq(entities.id, input.entity))
      .limit(1);
    if (!entity) {
      throw errors.NOT_FOUND({ message: "Entity not found." });
    }

    await db
      .insert(entityFollows)
      .values({
        userId: context.user.id,
        entityId: entity.id,
      })
      .onConflictDoNothing({
        target: [entityFollows.userId, entityFollows.entityId],
      });

    return { following: true };
  });
