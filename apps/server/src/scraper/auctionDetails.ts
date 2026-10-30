import { db, type AnyDatabase } from "@peated/server/db";
import { auctionLots, auctions, externalSites } from "@peated/server/db/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { ScotchWhiskyAuctionDetailsCursorSchema } from "./adapters/scotchWhiskyAuctions";

/** Returns true while supported detail work is pending. Repeated calls keep the same request. */
export async function requestAuctionLotDetails(
  lotId: number,
  fingerprint: string,
) {
  const requested = await db
    .update(auctionLots)
    .set({
      sourceDetailsRequestedAt: sql`COALESCE(${auctionLots.sourceDetailsRequestedAt}, NOW())`,
    })
    .where(
      and(
        eq(auctionLots.id, lotId),
        eq(auctionLots.sourceFingerprint, fingerprint),
        inArray(auctionLots.matchStatus, ["pending", "review"]),
        isNull(auctionLots.bottleId),
        isNull(auctionLots.sourceDetailsCheckedAt),
        sql`EXISTS (SELECT 1 FROM ${auctions} INNER JOIN ${externalSites} ON ${externalSites.id} = ${auctions.externalSiteId}
      WHERE ${auctions.id} = ${auctionLots.auctionId} AND ${externalSites.type} = 'scotchwhiskyauctions')`,
      ),
    )
    .returning({ id: auctionLots.id });
  return requested.length > 0;
}

/**
 * Auction detail rule (owner: auctions): a failed detail run keeps only the lot
 * it stopped on, which needs an admin retry. The scheduler reads the lots it
 * never reached again, so one bad page cannot block the rest of its batch.
 */
export async function releaseUnreadAuctionLotDetails(
  tx: AnyDatabase,
  run: { id: number; cursor: unknown },
) {
  const cursor = ScotchWhiskyAuctionDetailsCursorSchema.parse(run.cursor);
  const unread = cursor.lots
    .slice(cursor.lotIndex + 1)
    .map(({ lotId }) => lotId);
  if (!unread.length) return;
  await tx
    .update(auctionLots)
    .set({ sourceDetailsRunId: null })
    .where(
      and(
        inArray(auctionLots.id, unread),
        eq(auctionLots.sourceDetailsRunId, run.id),
        isNull(auctionLots.sourceDetailsCheckedAt),
      ),
    );
}
