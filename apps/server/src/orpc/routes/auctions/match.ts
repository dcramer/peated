import {
  assignAuctionLot,
  AuctionLotMatchChangedError,
  notifyAuctionLot,
} from "@peated/server/lib/auctions";
import { ActiveBottleSelectionError } from "@peated/server/lib/resolveActiveBottleIds";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "PUT",
    path: "/auction-lots/{lot}/bottle",
    summary: "Assign a reviewed auction lot",
    description:
      "Assign an auction lot to an active bottle after checking its source fingerprint and previous assignment. Requires a moderator.",
    operationId: "matchAuctionLot",
  })
  .input(
    z
      .object({
        lot: z.coerce.number().int().positive(),
        bottleId: z.number().int().positive(),
        fingerprint: z.string().min(1),
        expectedBottleId: z.number().int().positive().nullable(),
      })
      .strict(),
  )
  .output(z.object({ bottleId: z.number() }))
  .handler(async ({ input, context, errors }) => {
    try {
      await assignAuctionLot({
        lotId: input.lot,
        ...input,
        userId: context.user.id,
      });
    } catch (error) {
      if (error instanceof AuctionLotMatchChangedError)
        throw errors.CONFLICT({ message: error.message });
      if (error instanceof ActiveBottleSelectionError)
        throw errors.NOT_FOUND({ message: "Active bottle not found." });
      throw error;
    }
    await notifyAuctionLot(input.lot);
    return { bottleId: input.bottleId };
  });
