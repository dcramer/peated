import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { findBrandRepairCandidates } from "@peated/server/lib/brandRepairCandidates";
import { repairBottleBrandDistilleryAssignments } from "@peated/server/lib/repairBottleBrandDistilleryAssignments";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/bottles/apply-brand-repair-group",
    summary: "Apply BottleGroup-wide brand/entity repairs",
    description:
      "Group eligible candidate Bottles by BottleGroup. Apply each shared brand, optional distillery, and series repair to every Bottle in the group. Requires moderator privileges",
    spec: (spec) => ({
      ...spec,
      operationId: "applyBottleBrandRepairGroup",
    }),
  })
  .input(
    z.object({
      fromBrand: z.number(),
      toBrand: z.number(),
      distillery: z.number().nullable().default(null),
      query: z.coerce.string().default(""),
    }),
  )
  .output(
    z.object({
      appliedCount: z.number(),
      appliedGroupCount: z.number(),
      appliedGroupIds: z.array(z.number()),
      bottleIds: z.array(z.number()),
      candidateCount: z.number(),
      candidateBottleCount: z.number(),
      candidateBottleIds: z.array(z.number()),
      failedCount: z.number(),
      failedGroupCount: z.number(),
      failedGroupIds: z.array(z.number()),
      groupIds: z.array(z.number()),
      status: z.literal("applied"),
    }),
  )
  .handler(async function ({ input, context, errors }) {
    const [fromBrand, toBrand, distillery] = await Promise.all([
      db.query.entities.findFirst({
        where: eq(entities.id, input.fromBrand),
      }),
      db.query.entities.findFirst({
        where: eq(entities.id, input.toBrand),
      }),
      input.distillery === null
        ? Promise.resolve(null)
        : db.query.entities.findFirst({
            where: eq(entities.id, input.distillery),
          }),
    ]);

    if (!fromBrand) {
      throw errors.BAD_REQUEST({
        message: "Source brand is invalid.",
      });
    }

    if (!toBrand) {
      throw errors.BAD_REQUEST({
        message: "Target brand is invalid.",
      });
    }

    const candidates = (
      await findBrandRepairCandidates({
        currentBrandId: fromBrand.id,
        query: input.query,
        targetBrandId: toBrand.id,
      })
    ).filter(
      (candidate) =>
        (candidate.suggestedDistillery?.id ?? null) ===
        (distillery?.id ?? null),
    );
    const bottleIds = candidates.map((candidate) => candidate.bottle.id);

    if (bottleIds.length === 0) {
      throw errors.BAD_REQUEST({
        message:
          "No eligible brand repair candidates matched this source and target brand pair.",
      });
    }

    const result = await repairBottleBrandDistilleryAssignments({
      bottleIds,
      distilleryId: distillery?.id ?? null,
      dryRun: false,
      fromBrand,
      toBrand,
      user: context.user,
    });
    const groupIds = Array.from(
      new Set(
        result.items.flatMap(({ groupId }) =>
          groupId === null ? [] : [groupId],
        ),
      ),
    ).sort((left, right) => left - right);
    const groupIdsForStatus = (status: "applied" | "failed") =>
      Array.from(
        new Set(
          result.items.flatMap((item) =>
            item.status === status && item.groupId !== null
              ? [item.groupId]
              : [],
          ),
        ),
      ).sort((left, right) => left - right);
    const appliedGroupIds = groupIdsForStatus("applied");
    const failedGroupIds = groupIdsForStatus("failed");

    return {
      appliedCount: result.summary.applied,
      appliedGroupCount: appliedGroupIds.length,
      appliedGroupIds,
      bottleIds,
      candidateCount: bottleIds.length,
      candidateBottleCount: bottleIds.length,
      candidateBottleIds: bottleIds,
      failedCount: result.summary.failed,
      failedGroupCount: failedGroupIds.length,
      failedGroupIds,
      groupIds,
      status: "applied" as const,
    };
  });
