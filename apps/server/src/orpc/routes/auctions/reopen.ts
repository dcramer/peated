import {
  AuctionLotMatchChangedError,
  reopenAuctionLot,
} from "@peated/server/lib/auctions";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/auction-lots/{lot}/reopen",
    summary: "Reopen an ignored auction lot",
    description:
      "Return an ignored lot that is one whisky bottle to review, after checking its source fingerprint and saved check. The lot keeps its saved check, has no Bottle, and is not sent to the classifier. Requires a moderator.",
    operationId: "reopenAuctionLot",
  })
  .input(
    z
      .object({
        lot: z.coerce.number().int().positive(),
        fingerprint: z.string().min(1),
        expectedCheckId: z.number().int().positive().nullable(),
      })
      .strict(),
  )
  .output(z.object({ lotId: z.number() }))
  .handler(async ({ input, context, errors }) => {
    try {
      await reopenAuctionLot({
        lotId: input.lot,
        fingerprint: input.fingerprint,
        expectedCheckId: input.expectedCheckId,
        userId: context.user.id,
      });
    } catch (error) {
      if (error instanceof AuctionLotMatchChangedError)
        throw errors.CONFLICT({
          message: "This lot changed or is not ignored. Refresh it.",
        });
      throw error;
    }
    return { lotId: input.lot };
  });
