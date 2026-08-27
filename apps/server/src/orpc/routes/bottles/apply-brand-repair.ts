import { db } from "@peated/server/db";
import { bottles, entities } from "@peated/server/db/schema";
import { findBrandRepairCandidates } from "@peated/server/lib/brandRepairCandidates";
import { repairBottleBrandDistilleryAssignments } from "@peated/server/lib/repairBottleBrandDistilleryAssignments";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
import { z } from "zod";

const RepairSeriesActionSchema = z.enum([
  "none",
  "reuse_existing",
  "create_new",
]);

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/bottles/{bottle}/apply-brand-repair",
    summary: "Apply BottleGroup-wide brand/entity repair",
    description:
      "Repair the Bottle Group shared brand identity and apply the resulting name, optional distillery link, and moved series to every Bottle. Requires moderator privileges",
    spec: (spec) => ({
      ...spec,
      operationId: "applyBottleBrandRepair",
    }),
  })
  .input(
    z.object({
      bottle: z.coerce.number(),
      fromBrand: z.number(),
      toBrand: z.number(),
      distillery: z.number().nullable().default(null),
    }),
  )
  .output(
    z.object({
      bottleId: z.number(),
      bottleFullName: z.string(),
      distilleryAdded: z.boolean(),
      groupId: z.number(),
      message: z.string(),
      seriesAction: RepairSeriesActionSchema,
      status: z.literal("applied"),
    }),
  )
  .handler(async function ({ input, context, errors }) {
    const [bottle, fromBrand, toBrand, distillery] = await Promise.all([
      db.query.bottles.findFirst({
        where: eq(bottles.id, input.bottle),
      }),
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

    if (!bottle) {
      throw errors.NOT_FOUND({
        message: "Bottle not found.",
      });
    }

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

    if (bottle.brandId !== fromBrand.id) {
      throw errors.BAD_REQUEST({
        message: "Bottle is no longer attached to the source brand.",
      });
    }

    const candidates = await findBrandRepairCandidates({
      currentBrandId: fromBrand.id,
      query: bottle.fullName,
      targetBrandId: toBrand.id,
    });
    const candidate = candidates.find(
      (candidate) => candidate.bottle.id === bottle.id,
    );
    if (!candidate) {
      throw errors.BAD_REQUEST({
        message: "Bottle is not an eligible brand repair candidate.",
      });
    }

    const suggestedDistilleryId = candidate.suggestedDistillery?.id ?? null;
    if ((distillery?.id ?? null) !== suggestedDistilleryId) {
      throw errors.BAD_REQUEST({
        message: "Requested distillery does not match the repair candidate.",
      });
    }

    const result = await repairBottleBrandDistilleryAssignments({
      bottleIds: [bottle.id],
      distilleryId: distillery?.id ?? null,
      dryRun: false,
      fromBrand,
      toBrand,
      user: context.user,
    });

    const appliedItem = result.items[0];
    if (!appliedItem) {
      throw errors.BAD_REQUEST({
        message: "Bottle brand repair did not produce any work items.",
      });
    }

    if (appliedItem.status !== "applied" || appliedItem.groupId === null) {
      throw errors.BAD_REQUEST({
        message: appliedItem.message,
      });
    }

    return {
      bottleId: appliedItem.bottleId,
      bottleFullName: appliedItem.bottleFullName,
      distilleryAdded: appliedItem.distilleryAdded,
      groupId: appliedItem.groupId,
      message: appliedItem.message,
      seriesAction: appliedItem.seriesAction,
      status: "applied" as const,
    };
  });
