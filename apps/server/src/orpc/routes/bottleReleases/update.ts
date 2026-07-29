import {
  LegacyBottleReleasePromotionError,
  resolveLegacyBottleReleasePromotion,
} from "@peated/server/lib/legacyBottleReleasePromotion";
import { logInfo } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleReleaseInputSchema, BottleSchema } from "@peated/server/schemas";
import { z } from "zod";

// Preserve the retired request contract so legacy callers receive a deliberate
// replacement response instead of failing input validation first.
const InputSchema = z.object({
  release: z.coerce.number(),
  edition: BottleReleaseInputSchema.shape.edition.removeDefault().optional(),
  statedAge: BottleReleaseInputSchema.shape.statedAge
    .removeDefault()
    .optional(),
  abv: BottleReleaseInputSchema.shape.abv.removeDefault().optional(),
  caskStrength: BottleReleaseInputSchema.shape.caskStrength
    .removeDefault()
    .optional(),
  singleCask: BottleReleaseInputSchema.shape.singleCask
    .removeDefault()
    .optional(),
  vintageYear: BottleReleaseInputSchema.shape.vintageYear
    .removeDefault()
    .optional(),
  releaseYear: BottleReleaseInputSchema.shape.releaseYear
    .removeDefault()
    .optional(),
  caskType: BottleReleaseInputSchema.shape.caskType.removeDefault().optional(),
  caskSize: BottleReleaseInputSchema.shape.caskSize.removeDefault().optional(),
  caskFill: BottleReleaseInputSchema.shape.caskFill.removeDefault().optional(),
  description: BottleReleaseInputSchema.shape.description
    .removeDefault()
    .optional(),
  tastingNotes: BottleReleaseInputSchema.shape.tastingNotes
    .removeDefault()
    .optional(),
  imageUrl: BottleReleaseInputSchema.shape.imageUrl.removeDefault().optional(),
});

/**
 * Refuses the retired BottleRelease mutation while resolving its canonical
 * Bottle so callers can move to the direct-Bottle update route.
 */
export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/bottle-releases/{release}",
    summary: "Update bottle bottling",
    description:
      "Resolve a legacy bottling to its promoted Bottle and require the canonical Bottle update route. Requires moderator privileges",
    spec: (spec) => ({
      ...spec,
      operationId: "updateBottleRelease",
    }),
  })
  .input(InputSchema)
  .output(BottleSchema)
  .handler(async function ({ input, errors }) {
    let promotion;
    try {
      promotion = await resolveLegacyBottleReleasePromotion({
        releaseId: input.release,
        context: {
          access: "write",
          caller: "bottleReleases.update",
          operation: "require_concrete_bottle_update",
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
        caller: "bottleReleases.update",
        operation: "require_concrete_bottle_update",
        outcome: "bottle_update_required",
        legacyBottleId: promotion.release.bottleId,
        releaseId: promotion.release.id,
        replacementBottleId: promotion.bottle.id,
      },
    });

    throw errors.CONFLICT({
      message: `BottleRelease ${promotion.release.id} maps to Bottle ${promotion.bottle.id}; update that Bottle through PATCH /bottles/${promotion.bottle.id} instead.`,
      data: { bottle: promotion.bottle.id },
    });
  });
