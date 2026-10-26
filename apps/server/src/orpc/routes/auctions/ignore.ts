import {
  AuctionLotMatchChangedError,
  ignoreAuctionLot,
} from "@peated/server/lib/auctions";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/auction-lots/{lot}/ignore",
    summary: "Ignore an auction lot",
    description:
      "Ignore a lot that is not one whisky bottle, such as a sample, glassware, or another spirit, after checking its source fingerprint, assignment, and saved check. Clears any assignment. Requires a moderator.",
    operationId: "ignoreAuctionLot",
  })
  .input(
    z
      .object({
        lot: z.coerce.number().int().positive(),
        fingerprint: z.string().min(1),
        expectedBottleId: z.number().int().positive().nullable(),
        expectedCheckId: z.number().int().positive().nullable(),
      })
      .strict(),
  )
  .output(z.object({ lotId: z.number() }))
  .handler(async ({ input, context, errors }) => {
    try {
      await ignoreAuctionLot({
        lotId: input.lot,
        fingerprint: input.fingerprint,
        expectedBottleId: input.expectedBottleId,
        expectedCheckId: input.expectedCheckId,
        userId: context.user.id,
      });
    } catch (error) {
      if (error instanceof AuctionLotMatchChangedError)
        throw errors.CONFLICT({
          message: "This lot changed or is already ignored. Refresh it.",
        });
      throw error;
    }
    return { lotId: input.lot };
  });
