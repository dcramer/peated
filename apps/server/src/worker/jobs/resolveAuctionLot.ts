import { resolveAuctionLot } from "@peated/server/lib/auctionMatching";
import { notifyAuctionLot } from "@peated/server/lib/auctions";
import type { JobPayload } from "@peated/server/worker/types";
import { z } from "zod";

export const ResolveAuctionLotJobArgsSchema = z
  .object({
    lotId: z.number().int().positive(),
    fingerprint: z.string().min(1),
  })
  .strict();

export default async function resolveAuctionLotJob(input: JobPayload) {
  const { lotId, fingerprint } = ResolveAuctionLotJobArgsSchema.parse(input);
  await resolveAuctionLot(lotId, fingerprint);
  await notifyAuctionLot(lotId);
}
