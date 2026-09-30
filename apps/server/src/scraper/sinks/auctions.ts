import {
  notifyAuctionLot,
  upsertAuctionObservation,
} from "@peated/server/lib/auctions";
import type { AuctionObservation } from "@peated/server/schemas/auctions";
import { pushUniqueJob } from "@peated/server/worker/dispatch";
import type { ScraperSink } from "../types";

export const auctionSink: ScraperSink<AuctionObservation[]> = async ({
  externalSiteId,
  observation,
}) => {
  let newItemCount = 0;
  for (const item of observation.value) {
    const { lot, isNew } = await upsertAuctionObservation(externalSiteId, item);
    if (isNew) newItemCount += 1;
    if (lot.matchStatus === "pending") {
      await pushUniqueJob("ResolveAuctionLot", {
        lotId: lot.id,
        fingerprint: lot.sourceFingerprint,
      });
    }
    await notifyAuctionLot(lot.id);
  }
  return {
    newItemCount,
    existingItemCount: observation.value.length - newItemCount,
  };
};
