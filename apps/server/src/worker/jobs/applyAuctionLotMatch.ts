import { applySavedAuctionLotMatch } from "@peated/server/lib/auctionMatching";
import { notifyAuctionLot } from "@peated/server/lib/auctions";
import { pushUniqueJob } from "@peated/server/worker/client";
import type { JobPayload } from "@peated/server/worker/types";
import { ResolveAuctionLotJobArgsSchema } from "./resolveAuctionLot";

export default async function applyAuctionLotMatchJob(input: JobPayload) {
  const args = ResolveAuctionLotJobArgsSchema.parse(input);
  const complete = await applySavedAuctionLotMatch(
    args.lotId,
    args.fingerprint,
  );
  if (!complete) {
    await pushUniqueJob("ResolveAuctionLot", args);
    return;
  }
  await notifyAuctionLot(args.lotId);
}
