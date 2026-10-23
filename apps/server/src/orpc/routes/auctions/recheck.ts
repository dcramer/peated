import { db } from "@peated/server/db";
import { auctionLots, bottleChecks } from "@peated/server/db/schema";
import { auctionLotCheckKey } from "@peated/server/lib/auctionMatchEvidence";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { pushUniqueJob } from "@peated/server/worker/client";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z
  .object({
    lots: z
      .array(
        z
          .object({
            lotId: z.number().int().positive(),
            fingerprint: z.string().min(1),
            expectedBottleId: z.number().int().positive().nullable(),
            expectedCheckId: z.number().int().positive().nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .refine(
    ({ lots }) => new Set(lots.map(({ lotId }) => lotId)).size === lots.length,
    "Supply each lot once.",
  );

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/auction-lots/recheck",
    summary: "Recheck imported auction lots",
    description:
      "Recheck up to 100 unresolved lots with observed source, assignment, and saved-check versions. Reuse current evidence; skip matched or ignored lots. Requires an administrator.",
    operationId: "recheckAuctionLots",
  })
  .input(InputSchema)
  .output(
    z
      .object({ queued: z.array(z.number()), skipped: z.array(z.number()) })
      .strict(),
  )
  .handler(async ({ input, errors }) => {
    const result = await db.transaction(async (tx) => {
      const lots = await tx
        .select()
        .from(auctionLots)
        .where(
          inArray(
            auctionLots.id,
            input.lots.map(({ lotId }) => lotId),
          ),
        )
        .orderBy(asc(auctionLots.id))
        .for("update");
      const queued: { lotId: number; fingerprint: string }[] = [];
      const skipped: number[] = [];
      for (const expected of input.lots) {
        const lot = lots.find(({ id }) => id === expected.lotId);
        if (
          !lot ||
          lot.sourceFingerprint !== expected.fingerprint ||
          lot.bottleId !== expected.expectedBottleId ||
          lot.matchCheckId !== expected.expectedCheckId
        )
          throw errors.CONFLICT({
            message:
              "An auction lot changed. Refresh the entire batch before rechecking.",
          });
        if (lot.matchCheckId) {
          const check = await tx.query.bottleChecks.findFirst({
            where: eq(bottleChecks.id, lot.matchCheckId),
          });
          // Reject foreign source/version identities, but leave unsupported old evidence for review.
          if (
            !check ||
            check.sourceKind !== "auction_lot" ||
            check.sourceId !== String(lot.id) ||
            check.backgroundEventKey !==
              auctionLotCheckKey(lot.id, lot.sourceFingerprint)
          )
            throw errors.CONFLICT({
              message:
                "The saved check no longer belongs to this lot's identity.",
            });
        }
        if (lot.matchStatus === "matched" || lot.matchStatus === "ignored")
          skipped.push(lot.id);
        else queued.push({ lotId: lot.id, fingerprint: lot.sourceFingerprint });
      }
      if (queued.length)
        await tx
          .update(auctionLots)
          .set({ matchStatus: "pending" })
          .where(
            inArray(
              auctionLots.id,
              queued.map(({ lotId }) => lotId),
            ),
          );
      return { queued, skipped };
    });
    for (const args of result.queued)
      await pushUniqueJob("ApplyAuctionLotMatch", args);
    return {
      queued: result.queued.map(({ lotId }) => lotId),
      skipped: result.skipped,
    };
  });
