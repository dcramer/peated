import {
  LegacyBottleReleasePromotionError,
  resolveLegacyBottleReleasePromotion,
} from "@peated/server/lib/legacyBottleReleasePromotion";
import { logInfo } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { z } from "zod";

/**
 * Measured refusal boundary because grouped retirement requires an explicit
 * Bottle merge.
 * Tasks 8.6 and 8.7 disable and then remove this legacy write surface.
 */
export default procedure
  .use(requireAdmin)
  .route({
    method: "DELETE",
    path: "/bottle-releases/{release}",
    summary: "Delete bottle bottling",
    description:
      "Resolve a legacy bottling to its promoted Bottle and require an explicit merge. Requires admin privileges",
    spec: (spec) => ({
      ...spec,
      operationId: "deleteBottleRelease",
    }),
  })
  .input(z.object({ release: z.coerce.number() }))
  .output(z.object({}))
  .handler(async function ({ input, errors }) {
    let promotion;
    try {
      promotion = await resolveLegacyBottleReleasePromotion({
        releaseId: input.release,
        context: {
          access: "write",
          caller: "bottleReleases.delete",
          operation: "require_concrete_bottle_merge",
        },
      });
    } catch (error) {
      if (error instanceof LegacyBottleReleasePromotionError) {
        if (error.code === "release_not_found") {
          throw errors.NOT_FOUND({ message: error.message, cause: error });
        }
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }

    logInfo("Legacy BottleRelease compatibility write refused", {
      extra: {
        event: "bottle_release.compatibility",
        access: "write",
        caller: "bottleReleases.delete",
        operation: "require_concrete_bottle_merge",
        outcome: "merge_required",
        legacyBottleId: promotion.release.bottleId,
        releaseId: promotion.release.id,
        replacementBottleId: promotion.bottle.id,
      },
    });

    throw errors.CONFLICT({
      message: `BottleRelease ${promotion.release.id} maps to Bottle ${promotion.bottle.id}; merge that Bottle into an explicit destination instead.`,
      data: { bottle: promotion.bottle.id },
    });
  });
