import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure } from "..";
import { db } from "../../db";
import {
  bottleAliases,
  bottleReleases,
  bottles,
  changes,
  collectionBottles,
  flightBottles,
  tastings,
} from "../../db/schema";

export default adminProcedure.input(z.number()).mutation(async function ({
  input,
  ctx,
}) {
  const [release] = await db
    .select()
    .from(bottleReleases)
    .where(eq(bottleReleases.id, input))
    .limit(1);
  if (!release) {
    throw new TRPCError({
      message: "Release not found.",
      code: "NOT_FOUND",
    });
  }

  await db.transaction(async (tx) => {
    await Promise.all([
      // Log the deletion in changes table
      tx.insert(changes).values({
        objectType: "bottle_release",
        objectId: release.bottleId,
        createdById: ctx.user.id,
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
