import { db } from "@peated/server/db";
import { wrongPhotoMatches } from "@peated/server/db/schema";
import { logError } from "@peated/server/lib/log";
import { deleteUploadByUrl } from "@peated/server/lib/uploads";
import { and, eq, isNotNull, lte } from "drizzle-orm";

// Retention rule: a wrong photo match keeps the member's label photo for 30
// days. The record and its label facts stay for classifier checks.
export const WRONG_PHOTO_MATCH_PHOTO_TTL_MS = 1000 * 60 * 60 * 24 * 30;

/** Deletes wrong-photo-match photos older than the retention window. */
export async function cleanupWrongPhotoMatchPhotos({
  now = new Date(),
  limit = 100,
}: {
  now?: Date;
  limit?: number;
} = {}): Promise<{ deleted: number }> {
  const expired = await db
    .select({ id: wrongPhotoMatches.id, imageUrl: wrongPhotoMatches.imageUrl })
    .from(wrongPhotoMatches)
    .where(
      and(
        isNotNull(wrongPhotoMatches.imageUrl),
        lte(
          wrongPhotoMatches.createdAt,
          new Date(now.getTime() - WRONG_PHOTO_MATCH_PHOTO_TTL_MS),
        ),
      ),
    )
    .limit(limit);

  let deleted = 0;
  for (const match of expired) {
    try {
      // Delete the file first; a failure leaves the URL so the next run retries.
      await deleteUploadByUrl(match.imageUrl!);
      await db
        .update(wrongPhotoMatches)
        .set({ imageUrl: null })
        .where(eq(wrongPhotoMatches.id, match.id));
      deleted += 1;
    } catch (err) {
      logError(err, { wrongPhotoMatch: { id: match.id } });
    }
  }

  return { deleted };
}
