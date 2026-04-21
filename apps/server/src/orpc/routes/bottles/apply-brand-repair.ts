import { db } from "@peated/server/db";
import { bottles, entities } from "@peated/server/db/schema";
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
    summary: "Apply bottle brand/entity repair",
    description:
      "Move a bottle onto the correct brand entity, optionally preserving the source entity as a distillery link and re-homing its series under the target brand. Requires moderator privileges",
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
      message: z.string(),
      releaseCount: z.number(),
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

    if (bottle.brandId !== fromBrand.id) {
      throw errors.BAD_REQUEST({
        message: "Bottle is no longer attached to the source brand.",
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

    if (appliedItem.status !== "applied") {
      throw errors.BAD_REQUEST({
        message: appliedItem.message,
      });
    }

    return {
      bottleId: appliedItem.bottleId,
      bottleFullName: appliedItem.bottleFullName,
      distilleryAdded: appliedItem.distilleryAdded,
      message: appliedItem.message,
      releaseCount: appliedItem.releaseCount,
      seriesAction: appliedItem.seriesAction,
      status: "applied" as const,
    };
  });
