import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleReleases,
  bottles,
  changes,
  collectionBottles,
  flightBottles,
  tastings,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "DELETE",
    path: "/bottle-releases/{release}",
    summary: "Delete bottle release",
    spec: {},
    description:
      "Delete a bottle release and remove its references from related entities. Requires admin privileges",
  })
  .input(z.object({ release: z.coerce.number() }))
  .output(z.object({}))
  .handler(async function ({ input, context, errors }) {
    const [release] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, input.release))
      .limit(1);
    if (!release) {
      throw errors.NOT_FOUND({
        message: "Release not found.",
      });
    }

    await db.transaction(async (tx) => {
      await Promise.all([
        // Log the deletion in changes table
        tx.insert(changes).values({
          objectType: "bottle_release",
          objectId: release.bottleId,
          createdById: context.user.id,
          displayName: release.fullName,
          type: "delete",
          data: release,
        }),

        // Update bottle aliases to remove release reference
        tx
          .update(bottleAliases)
          .set({ releaseId: null })
          .where(eq(bottleAliases.releaseId, release.id)),

        // Update collection bottles to remove release reference
        tx
          .update(collectionBottles)
          .set({ releaseId: null })
          .where(eq(collectionBottles.releaseId, release.id)),

        // Update flight bottles to remove release reference
        tx
          .update(flightBottles)
          .set({ releaseId: null })
          .where(eq(flightBottles.releaseId, release.id)),

        // Update tastings to remove release reference
        tx
          .update(tastings)
          .set({ releaseId: null })
          .where(eq(tastings.releaseId, release.id)),
      ]);
      // Delete the release
      const affected = await tx
        .delete(bottleReleases)
        .where(eq(bottleReleases.id, release.id))
        .returning({ id: bottleReleases.id });

      if (affected.length !== 0) {
        await tx
          .update(bottles)
          .set({
            numReleases: sql`${bottles.numReleases} - ${affected.length}`,
          })
          .where(eq(bottles.id, release.bottleId));
      }
    });

    return {};
  });
