import { db } from "@peated/server/db";
import {
  auctionLotResults,
  auctions,
  externalSites,
  type AuctionLot,
} from "@peated/server/db/schema";
import { auctionAvailability } from "@peated/server/lib/auctions";
import { AuctionLotSchema } from "@peated/server/schemas/auctions";
import { desc, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import { serializer } from ".";

export const AuctionLotSerializer = serializer({
  name: "auctionLot",
  attrs: async (lots: AuctionLot[]) => {
    const auctionIds = [...new Set(lots.map((lot) => lot.auctionId))];
    const auctionRows = await db
      .select({
        id: auctions.id,
        name: auctions.name,
        url: auctions.url,
        site: { name: externalSites.name, type: externalSites.type },
      })
      .from(auctions)
      .innerJoin(externalSites, eq(auctions.externalSiteId, externalSites.id))
      .where(inArray(auctions.id, auctionIds));
    const results = await db
      .selectDistinctOn([auctionLotResults.lotId])
      .from(auctionLotResults)
      .where(
        inArray(
          auctionLotResults.lotId,
          lots.map((lot) => lot.id),
        ),
      )
      .orderBy(auctionLotResults.lotId, desc(auctionLotResults.id));
    const byAuction = new Map(
      auctionRows.map((auction) => [auction.id, auction]),
    );
    const byLot = new Map(results.map((result) => [result.lotId, result]));
    return Object.fromEntries(
      lots.map((lot) => {
        const auction = byAuction.get(lot.auctionId);
        if (!auction) throw new Error(`Auction ${lot.auctionId} is missing.`);
        return [lot.id, { auction, result: byLot.get(lot.id) ?? null }];
      }),
    );
  },
  item: (lot, attrs): z.infer<typeof AuctionLotSchema> =>
    AuctionLotSchema.parse({
      id: lot.id,
      bottleId: lot.bottleId,
      auction: attrs.auction,
      lotNumber: lot.lotNumber,
      name: lot.name,
      url: lot.url,
      volume: lot.volume,
      condition: lot.condition,
      state: lot.state,
      availability: auctionAvailability(lot),
      endsAt: lot.endsAt?.toISOString() ?? null,
      currentBid: lot.currentBid,
      bidCurrency: lot.bidCurrency,
      lastCheckedAt: lot.lastCheckedAt.toISOString(),
      result: attrs.result
        ? {
            ...attrs.result,
            soldAt: attrs.result.soldAt?.toISOString() ?? null,
            observedAt: attrs.result.observedAt.toISOString(),
          }
        : null,
    }),
});
