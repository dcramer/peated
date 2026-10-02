import { db } from "@peated/server/db";
import { auctionLots, auctions, externalSites } from "@peated/server/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

/** Only newly unresolved supported lots opt in. Deployment does not crawl the saved review backlog. */
export async function requestAuctionLotDetails(
  lotId: number,
  fingerprint: string,
) {
  await db
    .update(auctionLots)
    .set({ sourceDetailsRequestedAt: new Date() })
    .where(
      and(
        eq(auctionLots.id, lotId),
        eq(auctionLots.sourceFingerprint, fingerprint),
        eq(auctionLots.matchStatus, "review"),
        isNull(auctionLots.bottleId),
        isNull(auctionLots.sourceDetailsRequestedAt),
        isNull(auctionLots.sourceDetailsCheckedAt),
        sql`EXISTS (SELECT 1 FROM ${auctions} INNER JOIN ${externalSites} ON ${externalSites.id} = ${auctions.externalSiteId}
      WHERE ${auctions.id} = ${auctionLots.auctionId} AND ${externalSites.type} = 'scotchwhiskyauctions')`,
      ),
    );
}
