import { db } from "@peated/server/db";
import { auctionWatches } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "GET",
    path: "/bottles/{bottle}/auction-watch",
    summary: "Get your auction watch",
    operationId: "getAuctionWatch",
  })
  .input(z.object({ bottle: z.coerce.number().int().positive() }))
  .output(z.object({ watching: z.boolean() }))
  .handler(async ({ input, context }) => ({
    watching: Boolean(
      await db.query.auctionWatches.findFirst({
        where: and(
          eq(auctionWatches.userId, context.user.id),
          eq(auctionWatches.bottleId, input.bottle),
        ),
      }),
    ),
  }));
