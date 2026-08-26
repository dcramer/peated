import { db } from "@peated/server/db";
import { entities, entityFollows } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "DELETE",
    path: "/entities/{entity}/follow",
    summary: "Unfollow entity",
    description:
      "Stop following a brand, distiller, or bottler. Requires authentication.",
    operationId: "unfollowEntity",
  })
  .input(z.object({ entity: z.coerce.number() }).strict())
  .output(z.object({ following: z.literal(false) }))
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
      .delete(entityFollows)
      .where(
        and(
          eq(entityFollows.userId, context.user.id),
          eq(entityFollows.entityId, entity.id),
        ),
      );

    return { following: false };
  });
