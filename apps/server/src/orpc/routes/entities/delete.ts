import { db } from "@peated/server/db";
import {
  changes,
  entities,
  entityAliases,
  entityImages,
  entityReferences,
  entityTombstones,
} from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { findAboutPageLinking } from "@peated/server/lib/entityAbout/store";
import { deleteOwnedEntityImage } from "@peated/server/lib/entityImages";
import { deleteOwnedPronunciationAudio } from "@peated/server/lib/entityPronunciationAudio";
import { closeOpenReportsForTarget } from "@peated/server/lib/reports";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "DELETE",
    path: "/entities/{entity}",
    summary: "Delete entity",
    description:
      "Delete an entity and its aliases and reference names while reserving its public ID so it cannot be reused. Fails when another entity's About page links it; merge it instead. Requires administrator privileges.",
    operationId: "deleteEntity",
  })
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

    const images = await db
      .select({ imageUrl: entityImages.imageUrl })
      .from(entityImages)
      .where(eq(entityImages.entityId, entity.id));

    await db.transaction(async (tx) => {
      const linkedFrom = await findAboutPageLinking(tx, entity.id);
      if (linkedFrom) {
        throw errors.CONFLICT({
          message: `The About page of entity ${linkedFrom} links this entity. Merge it instead, or remove the link first.`,
        });
      }
      const actorId = (await getUserActorForDatabase(tx, context.user)).id;

      await Promise.all([
        tx.insert(changes).values({
          objectType: "entity",
          objectId: entity.id,
          actorId,
          displayName: entity.name,
          type: "delete",
          data: {
            ...entity,
          },
        }),

        tx.delete(entityAliases).where(eq(entityAliases.entityId, entity.id)),
        tx
          .delete(entityReferences)
          .where(eq(entityReferences.entityId, entity.id)),

        tx.insert(entityTombstones).values({
          entityId: entity.id,
        }),
      ]);

      await tx.delete(entities).where(eq(entities.id, entity.id));
      await closeOpenReportsForTarget(
        tx,
        { objectType: "entity", objectId: entity.id },
        { closedById: context.user.id, note: "Entity deleted." },
      );
    });

    await Promise.all([
      ...images.map((image) => deleteOwnedEntityImage(image.imageUrl)),
      deleteOwnedPronunciationAudio(entity.pronunciationAudioUrl),
    ]);

    return {};
  });
