import {
  notifyAuctionLot,
  saveAuctionLotDetails,
  upsertAuctionObservation,
} from "@peated/server/lib/auctions";
import { pushUniqueJob } from "@peated/server/worker/dispatch";
import type { ScotchWhiskyAuctionsObservation } from "../adapters/scotchWhiskyAuctions";
import type { ScraperSink } from "../types";

export const auctionSink: ScraperSink<
  ScotchWhiskyAuctionsObservation
> = async ({ externalSiteId, observation }) => {
  if (!Array.isArray(observation.value)) {
    const lot = await saveAuctionLotDetails(externalSiteId, observation.value);
    if (lot?.matchStatus === "pending")
      await pushUniqueJob("ApplyAuctionLotMatch", {
        lotId: lot.id,
        fingerprint: lot.sourceFingerprint,
      });
    return { newItemCount: 0, existingItemCount: lot ? 1 : 0 };
  }
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
