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
    summary: "Apply grouped bottle brand/entity repair",
    description:
      "Move every currently eligible bottle in a source-brand to target-brand repair cluster, optionally preserving the source entity as a distillery link. Requires moderator privileges",
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
      bottleIds: z.array(z.number()),
      candidateCount: z.number(),
      failedCount: z.number(),
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

    if (!fromBrand || !fromBrand.type.includes("brand")) {
      throw errors.BAD_REQUEST({
        message: "Source brand is invalid.",
      });
    }

    if (!toBrand || !toBrand.type.includes("brand")) {
      throw errors.BAD_REQUEST({
        message: "Target brand is invalid.",
      });
    }

    if (distillery && !distillery.type.includes("distiller")) {
      throw errors.BAD_REQUEST({
        message: "Suggested distillery is invalid.",
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

    return {
      appliedCount: result.summary.applied,
      bottleIds,
      candidateCount: bottleIds.length,
      failedCount: result.summary.failed,
      status: "applied" as const,
    };
  });
