import { db } from "@peated/server/db";
import {
  auctionLots,
  bottleTombstones,
  bottles,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { AuctionLotSchema } from "@peated/server/schemas/auctions";
import { listResponse } from "@peated/server/schemas/shared";
import { serialize } from "@peated/server/serializers";
import { AuctionLotSerializer } from "@peated/server/serializers/auctionLot";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/bottles/{bottle}/auctions",
    summary: "List bottle auctions",
    description:
      "List auction availability and the latest reported result for each lot.",
    operationId: "listBottleAuctions",
  })
  .input(
    z.object({
      bottle: z.coerce.number().int().positive(),
      cursor: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }),
  )
  .output(listResponse(AuctionLotSchema))
  .handler(async ({ input, context, errors }) => {
    const replacement = await db.query.bottleTombstones.findFirst({
      where: eq(bottleTombstones.bottleId, input.bottle),
    });
    const bottleId = replacement?.newBottleId ?? input.bottle;
    const bottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, bottleId),
    });
    if (!bottle) throw errors.NOT_FOUND({ message: "Bottle not found." });
    const rows = await db
      .select()
      .from(auctionLots)
      .where(eq(auctionLots.bottleId, bottle.id))
      .orderBy(desc(auctionLots.firstSeenAt), desc(auctionLots.id))
      .limit(input.limit + 1)
      .offset((input.cursor - 1) * input.limit);
    return {
      results: await serialize(
        AuctionLotSerializer,
        rows.slice(0, input.limit),
        context.user,
      ),
      rel: {
        nextCursor: rows.length > input.limit ? input.cursor + 1 : null,
        prevCursor: input.cursor > 1 ? input.cursor - 1 : null,
      },
    };
  });
