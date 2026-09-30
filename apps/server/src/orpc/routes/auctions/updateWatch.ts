import { db } from "@peated/server/db";
import { auctionWatches } from "@peated/server/db/schema";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "PUT",
    path: "/bottles/{bottle}/auction-watch",
    summary: "Update your auction watch",
    description:
      "Start or stop watching a bottle for new auction alerts for the signed-in user.",
    operationId: "updateAuctionWatch",
  })
  .input(
    z
      .object({
        bottle: z.coerce.number().int().positive(),
        watching: z.boolean(),
      })
      .strict(),
  )
  .output(z.object({ watching: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      await db.transaction(async (tx) => {
        await resolveActiveBottleIds(tx, [input.bottle]);
        if (input.watching) {
          await tx
            .insert(auctionWatches)
            .values({ userId: context.user.id, bottleId: input.bottle })
            .onConflictDoNothing();
        } else {
          await tx
            .delete(auctionWatches)
            .where(
              and(
                eq(auctionWatches.userId, context.user.id),
                eq(auctionWatches.bottleId, input.bottle),
              ),
            );
        }
      });
    } catch (error) {
      if (error instanceof ActiveBottleSelectionError)
        throw errors.NOT_FOUND({ message: "Active bottle not found." });
      throw error;
    }
    return { watching: input.watching };
  });
