import {
  LegacyBottleReleasePromotionError,
  resolveLegacyBottleReleasePromotion,
} from "@peated/server/lib/legacyBottleReleasePromotion";
import { procedure } from "@peated/server/orpc";
import { z } from "zod";

const InputSchema = z
  .object({
    bottle: z.coerce.number().int().positive(),
    release: z.coerce.number().int().positive(),
  })
  .strict();

/**
 * Resolves a nested legacy Bottling URL to its promoted Bottle.
 * Task 8.7 removes this measured API adapter after redirect traffic is gone.
 */
export default procedure
  .route({
    method: "GET",
    path: "/bottle-releases/{release}/bottle",
    summary: "Get Bottle for legacy release",
    description:
      "Resolve a legacy parent Bottle and BottleRelease pair to its promoted Bottle",
    spec: (spec) => ({
      ...spec,
      operationId: "getBottleForRelease",
    }),
  })
  .input(InputSchema)
  .output(
    z
      .object({
        bottleId: z.number().int().positive(),
      })
      .strict(),
  )
  .handler(async function ({ input, errors }) {
    try {
      const promotion = await resolveLegacyBottleReleasePromotion({
        releaseId: input.release,
        expectedParentBottleId: input.bottle,
        context: {
          access: "read",
          caller: "bottleReleases.bottle",
          operation: "redirect_legacy_nested_bottling",
        },
      });

      return { bottleId: promotion.bottle.id };
    } catch (error) {
      if (error instanceof LegacyBottleReleasePromotionError) {
        if (
          error.code === "release_not_found" ||
          error.code === "parent_mismatch"
        ) {
          throw errors.NOT_FOUND({
            message: "Legacy BottleRelease mapping not found.",
            cause: error,
          });
        }
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }
  });
