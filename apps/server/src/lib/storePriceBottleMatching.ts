import type {
  BottleCandidate,
  BottleExtractedDetails,
} from "@peated/bottle-classifier/internal/types";
import { normalizeBottleReferenceKey } from "@peated/bottle-classifier/normalize";
import { getExistingMatchIdentityConflicts } from "@peated/bottle-classifier/priceMatchingEvidence";
import type { AnyTransaction } from "@peated/server/db";
import { bottleBarcodes } from "@peated/server/db/schema";
import { findBottleReferenceAssignment } from "@peated/server/lib/bottleFinder";
import { getBottleCandidateById } from "@peated/server/lib/bottleReferenceCandidates";
import type { NormalizedGtin } from "@peated/server/lib/gtin";
import { resolveActiveBottleIds } from "@peated/server/lib/resolveActiveBottleIds";
import { eq } from "drizzle-orm";

export type StorePriceBottleMatch = {
  bottleId: number | null;
  candidate: BottleCandidate | null;
  source: "reference" | "barcode" | null;
  referenceMatch: Awaited<ReturnType<typeof findBottleReferenceAssignment>>;
};

/**
 * Matches a listing only from an exact saved name or an approved barcode.
 * A barcode sent by a store is evidence only: this code never approves it or
 * turns the store's title into a reference.
 */
export async function resolveStorePriceBottleMatchInTransaction(
  tx: AnyTransaction,
  {
    name,
    normalizedBarcode,
    sourceBottleIdentity,
    volume,
  }: {
    name: string;
    normalizedBarcode: NormalizedGtin | null;
    sourceBottleIdentity: BottleExtractedDetails | null;
    volume: number;
  },
): Promise<StorePriceBottleMatch> {
  const referenceKey = normalizeBottleReferenceKey(name);
  let referenceMatch = await findBottleReferenceAssignment(referenceKey, tx);
  if (!referenceMatch && referenceKey !== name) {
    referenceMatch = await findBottleReferenceAssignment(name, tx);
  }

  const barcodeBeforeLock = normalizedBarcode
    ? await tx.query.bottleBarcodes.findFirst({
        where: eq(bottleBarcodes.gtin14, normalizedBarcode.gtin14),
      })
    : null;

  if (!barcodeBeforeLock) {
    if (!referenceMatch) {
      return { bottleId: null, candidate: null, source: null, referenceMatch };
    }
    await resolveActiveBottleIds(tx, [referenceMatch.bottleId], {
      lock: "update",
    });
    return {
      bottleId: referenceMatch.bottleId,
      candidate: null,
      source: "reference",
      referenceMatch,
    };
  }

  await resolveActiveBottleIds(tx, [barcodeBeforeLock.bottleId], {
    lock: "update",
  });
  const [barcodeAfterLock, candidate] = await Promise.all([
    tx.query.bottleBarcodes.findFirst({
      where: eq(bottleBarcodes.gtin14, normalizedBarcode!.gtin14),
    }),
    getBottleCandidateById(barcodeBeforeLock.bottleId, tx),
  ]);
  const conflicts = candidate
    ? getExistingMatchIdentityConflicts({
        target: candidate,
        extractedLabel: sourceBottleIdentity,
      })
    : ["barcode target is not an active Bottle"];
  const bottleId =
    barcodeAfterLock?.bottleId === barcodeBeforeLock.bottleId &&
    (barcodeAfterLock.volume === null || barcodeAfterLock.volume === volume) &&
    conflicts.length === 0 &&
    (referenceMatch === null ||
      referenceMatch.bottleId === barcodeAfterLock.bottleId)
      ? barcodeAfterLock.bottleId
      : null;

  return {
    bottleId,
    candidate:
      bottleId !== null && candidate
        ? { ...candidate, source: [...candidate.source, "barcode"] }
        : null,
    source: bottleId !== null ? "barcode" : null,
    referenceMatch,
  };
}
