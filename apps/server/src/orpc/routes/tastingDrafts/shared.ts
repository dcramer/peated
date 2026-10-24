import type { AnyTransaction } from "@peated/server/db";
import { logError } from "@peated/server/lib/log";
import { deleteUploadByUrl } from "@peated/server/lib/uploads";
import { sql } from "drizzle-orm";

/**
 * Most drafts one member can keep. It protects the system from runaway
 * clients; it is not a product limit. See docs/features/tasting-drafts.md.
 */
export const MAX_TASTING_DRAFTS_PER_USER = 1000;

/**
 * Serializes one member's draft saves and publishes. Take it before locking
 * a draft row, so a save that races a publish sees the posted tasting and
 * cannot bring the draft back.
 */
export async function lockMemberTastingDrafts(
  tx: AnyTransaction,
  userId: number,
): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`tasting-draft:user:${userId}`}, 0))`,
  );
}

/** Best-effort: the draft change is already saved, so failures are logged. */
export async function removeTastingDraftPhoto(
  imageUrl: string,
  draftId: string,
): Promise<void> {
  try {
    await deleteUploadByUrl(imageUrl);
  } catch (error) {
    logError(error, {
      extra: { tastingDraftId: draftId, operation: "tastingDraft.removePhoto" },
    });
  }
}
