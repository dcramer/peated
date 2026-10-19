import type { ImagePhotoSuitability } from "@peated/server/agents/bottleClassifier";
import { db } from "@peated/server/db";
import { bottleImages, bottles } from "@peated/server/db/schema";
import { reconcileBottleSeriesRepresentativesForBottles } from "@peated/server/lib/bottleSeriesRepresentatives";
import { logError } from "@peated/server/lib/log";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

export const CatalogImageWarningSchema = z.object({
  code: z.literal("CATALOG_IMAGE_COPY_FAILED"),
  message: z.string(),
});
type CatalogImageWarning = z.infer<typeof CatalogImageWarningSchema>;

function buildCatalogImageWarning(): CatalogImageWarning {
  return {
    code: "CATALOG_IMAGE_COPY_FAILED",
    message: "The bottle was added, but the public image was not saved.",
  };
}

/**
 * Catalog photo rule (photo identification): a member's photo becomes the
 * public Bottle image only for a Bottle their confirmation just created, and
 * only when the photo was judged suitable for the catalog.
 */
export function canPromotePhotoToCatalog({
  createdBottle,
  photoSuitability,
}: {
  createdBottle: boolean;
  photoSuitability: ImagePhotoSuitability;
}) {
  return createdBottle && photoSuitability.suitableAsBottleImage === true;
}

/**
 * Copies a member's photo to a new Bottle's empty image slot. The Bottle is
 * already saved, so a failure is logged and returned as a warning. Never
 * replaces an existing Bottle image.
 */
export async function promotePhotoToCatalogImage({
  bottleId,
  actorId,
  copyImage,
  logContext,
}: {
  bottleId: number;
  actorId: number;
  copyImage: () => Promise<string>;
  logContext: Record<string, string | number | boolean>;
}): Promise<CatalogImageWarning | undefined> {
  const logFailure = (err: Error) =>
    logError(err, {
      catalogImagePromotion: { ...logContext, bottleId },
    });

  try {
    const [existingBottle] = await db
      .select({ imageUrl: bottles.imageUrl })
      .from(bottles)
      .where(eq(bottles.id, bottleId))
      .limit(1);
    if (!existingBottle || existingBottle.imageUrl) {
      return undefined;
    }

    const imageUrl = await copyImage();

    const updatedBottle = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(bottles)
        .set({ imageUrl })
        .where(and(eq(bottles.id, bottleId), isNull(bottles.imageUrl)))
        .returning({ id: bottles.id });
      if (!updated) return null;
      await tx.insert(bottleImages).values({
        bottleId,
        imageUrl,
        sourceUrl: null,
        license: null,
        isPrimary: true,
        createdByActorId: actorId,
      });
      await reconcileBottleSeriesRepresentativesForBottles(tx, [bottleId]);
      return updated;
    });
    if (!updatedBottle) {
      logFailure(
        new Error("Catalog image was copied but not saved to the bottle."),
      );
      return buildCatalogImageWarning();
    }

    return undefined;
  } catch (cause) {
    logFailure(
      cause instanceof Error
        ? cause
        : new Error("Catalog image approval failed.", { cause }),
    );
    return buildCatalogImageWarning();
  }
}
