import { BottleExtractedDetailsSchema } from "@peated/bottle-classifier/contract";
import { db } from "@peated/server/db";
import { auctionLots } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { AuctionLotSchema } from "@peated/server/schemas/auctions";
import { listResponse } from "@peated/server/schemas/shared";
import { serialize } from "@peated/server/serializers";
import { AuctionLotSerializer } from "@peated/server/serializers/auctionLot";
import { desc, inArray } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/auction-lots/match-queue",
    summary: "Review unresolved auction lots",
    description:
      "List unresolved auction lots with source identity and matching evidence for moderator review.",
    operationId: "listAuctionLotMatchQueue",
  })
  .input(
    z
      .object({
        cursor: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      })
      .default({ cursor: 1, limit: 50 }),
  )
  .output(
    listResponse(
      AuctionLotSchema.extend({
        fingerprint: z.string(),
        matchCheckId: z.number().nullable(),
        sourceBottleIdentity: BottleExtractedDetailsSchema.nullable(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    const rows = await db
      .select()
      .from(auctionLots)
      .where(inArray(auctionLots.matchStatus, ["pending", "review"]))
      .orderBy(desc(auctionLots.id))
      .limit(input.limit + 1)
      .offset((input.cursor - 1) * input.limit);
    const selected = rows.slice(0, input.limit);
    const results = await serialize(
      AuctionLotSerializer,
      selected,
      context.user,
    );
    return {
      results: results.map((item, at) => ({
        ...item,
        fingerprint: selected[at].sourceFingerprint,
        matchCheckId: selected[at].matchCheckId,
        sourceBottleIdentity: selected[at].sourceBottleIdentity,
      })),
      rel: {
        nextCursor: rows.length > input.limit ? input.cursor + 1 : null,
        prevCursor: input.cursor > 1 ? input.cursor - 1 : null,
      },
    };
  });
