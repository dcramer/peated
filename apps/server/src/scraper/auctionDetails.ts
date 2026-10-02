import { db } from "@peated/server/db";
import { auctionLots, auctions, externalSites } from "@peated/server/db/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

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
