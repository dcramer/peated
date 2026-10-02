import {
  BottleClassificationArtifactsSchema,
  BottleExtractedDetailsSchema,
} from "@peated/bottle-classifier/contract";
import { BottleClassificationDecisionSchema } from "@peated/bottle-classifier/internal/types";
import { db } from "@peated/server/db";
import { auctionLots, bottleChecks, bottles } from "@peated/server/db/schema";
import { readAuctionMatchEvidence } from "@peated/server/lib/auctionMatchEvidence";
import { getBottleCandidateById } from "@peated/server/lib/bottleReferenceCandidates";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleSchema } from "@peated/server/schemas";
import { AuctionLotSchema } from "@peated/server/schemas/auctions";
import { serialize } from "@peated/server/serializers";
import { AuctionLotSerializer } from "@peated/server/serializers/auctionLot";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/auction-lots/{lot}",
    summary: "Get auction matching evidence",
    description:
      "Get a lot's source facts, current assignment, and saved matching evidence. Ended lots remain available for review. Requires a moderator.",
    operationId: "getAuctionLot",
  })
  .input(z.object({ lot: z.coerce.number().int().positive() }).strict())
  .output(
    z
      .object({
        lot: AuctionLotSchema,
        fingerprint: z.string(),
        matchCheckId: z.number().nullable(),
        matchStatus: z.enum(["pending", "review", "matched", "ignored"]),
        sourceBottleIdentity: BottleExtractedDetailsSchema.nullable(),
        sourceImageUrl: z.url().nullable(),
        sourceDetailsRequestedAt: z.iso.datetime().nullable(),
        sourceDetailsCheckedAt: z.iso.datetime().nullable(),
        sourceDetailsRunId: z.number().nullable(),
        currentBottle: BottleSchema.nullable(),
        suggestedBottle: BottleSchema.nullable(),
        decision: BottleClassificationDecisionSchema.nullable(),
        artifacts: BottleClassificationArtifactsSchema.nullable(),
        canRememberReference: z.boolean(),
      })
      .strict(),
  )
  .handler(async ({ input, context, errors }) => {
    const lot = await db.query.auctionLots.findFirst({
      where: eq(auctionLots.id, input.lot),
    });
    if (!lot) throw errors.NOT_FOUND({ message: "Auction lot not found." });
    const check = lot.matchCheckId
      ? await db.query.bottleChecks.findFirst({
          where: eq(bottleChecks.id, lot.matchCheckId),
        })
      : null;
    const evidence = readAuctionMatchEvidence(lot, check);
    const decision =
      evidence?.output.status === "classified"
        ? evidence.output.decision
        : null;
    const current = lot.bottleId
      ? await db.query.bottles.findFirst({
          where: eq(bottles.id, lot.bottleId),
        })
      : null;
    const suggestedId = decision?.matchedBottleId;
    const activeSuggestion = suggestedId
      ? await getBottleCandidateById(suggestedId)
      : null;
    const suggestion = activeSuggestion
      ? await db.query.bottles.findFirst({
          where: eq(bottles.id, activeSuggestion.bottleId),
        })
      : null;
    return {
      lot: await serialize(AuctionLotSerializer, lot, context.user),
      fingerprint: lot.sourceFingerprint,
      matchCheckId: lot.matchCheckId,
      matchStatus: lot.matchStatus,
      sourceBottleIdentity: lot.sourceBottleIdentity,
      sourceImageUrl: lot.imageUrl,
      sourceDetailsRequestedAt:
        lot.sourceDetailsRequestedAt?.toISOString() ?? null,
      sourceDetailsCheckedAt: lot.sourceDetailsCheckedAt?.toISOString() ?? null,
      sourceDetailsRunId: lot.sourceDetailsRunId,
      currentBottle: current
        ? await serialize(BottleSerializer, current, context.user)
        : null,
      suggestedBottle: suggestion
        ? await serialize(BottleSerializer, suggestion, context.user)
        : null,
      decision,
      artifacts: evidence?.artifacts ?? null,
      canRememberReference:
        decision?.action === "match" &&
        decision.referenceScope === "global_alias" &&
        Boolean(suggestion),
    };
  });
