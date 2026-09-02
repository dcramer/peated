import { resolveStorePriceMatchProposal } from "@peated/server/lib/priceMatching";
import type { JobPayload } from "@peated/server/worker/types";
import { z } from "zod";

export const ResolveStorePriceBottleJobArgsSchema = z
  .object({
    priceId: z.number().int().positive(),
    force: z.boolean().optional(),
    processingToken: z.string().optional(),
  })
  .strict();

export default async (input: JobPayload) => {
  const { priceId, force, processingToken } =
    ResolveStorePriceBottleJobArgsSchema.parse(input);

  await resolveStorePriceMatchProposal(priceId, {
    force,
    processingToken,
  });
};
