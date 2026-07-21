import {
  CatalogTargetInvalidMappingError,
  CatalogTargetResolutionError,
  isStagedTargetlessCatalogMappingError,
  loadCatalogTargetByLegacyReference,
} from "@peated/server/lib/catalogTargets";
import { procedure } from "@peated/server/orpc";
import { z } from "zod";

const InputSchema = z
  .object({
    bottle: z.coerce.number().int().positive(),
    release: z.coerce.number().int().positive(),
  })
  .strict();

/**
 * Resolves a nested legacy Bottling URL to its promoted exact Bottle.
 * Task 9.7 removes this measured API adapter after redirect traffic is gone.
 */
export default procedure
  .route({
    method: "GET",
    path: "/bottle-releases/{release}/target",
    summary: "Get promoted Bottle target",
    description:
      "Resolve a legacy parent Bottle and BottleRelease pair to its promoted exact Bottle target",
    spec: (spec) => ({
      ...spec,
      operationId: "getBottleReleaseTarget",
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
      const target = await loadCatalogTargetByLegacyReference(
        { bottleId: input.bottle, releaseId: input.release },
        {
          actor: null,
          permissions: { canReadCatalogIdentity: true },
          caller: "bottleReleases.target",
          operation: "redirect_legacy_nested_bottling",
        },
      );

      if (target.kind !== "bottle") {
        throw errors.CONFLICT({
          message: "BottleRelease does not resolve to an exact Bottle target.",
        });
      }

      return { bottleId: target.bottle.id };
    } catch (error) {
      if (error instanceof CatalogTargetInvalidMappingError) {
        if (isStagedTargetlessCatalogMappingError(error)) {
          throw errors.CONFLICT({ message: error.message, cause: error });
        }

        throw errors.NOT_FOUND({
          message: "Legacy BottleRelease mapping not found.",
          cause: error,
        });
      }

      if (error instanceof CatalogTargetResolutionError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }

      throw error;
    }
  });
