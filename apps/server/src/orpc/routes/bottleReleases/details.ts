import {
  LegacyBottleReleasePromotionError,
  resolveLegacyBottleReleasePromotion,
} from "@peated/server/lib/legacyBottleReleasePromotion";
import { procedure } from "@peated/server/orpc";
import { BottleReleaseSchema, detailsResponse } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { z } from "zod";
import { projectLegacyBottleRelease } from "./project-legacy-release";

export default procedure
  .route({
    method: "GET",
    path: "/bottle-releases/{release}",
    summary: "Get bottle bottling details",
    description:
      "Retrieve detailed information about a specific bottling including bottle information",
    spec: (spec) => ({
      ...spec,
      operationId: "getBottleRelease",
    }),
  })
  .input(z.object({ release: z.coerce.number() }))
  // TODO(response-envelope): wrap in { data } by updating detailsResponse() at cutover
  .output(detailsResponse(BottleReleaseSchema))
  .handler(async function ({ input, context, errors }) {
    let promotion;
    try {
      promotion = await resolveLegacyBottleReleasePromotion({
        releaseId: input.release,
        context: {
          access: "read",
          caller: "bottleReleases.details",
          operation: "read_promoted_bottle",
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

    const serializedBottle = await serialize(
      BottleSerializer,
      promotion.bottle,
      context.user,
    );
    return projectLegacyBottleRelease(promotion.release, serializedBottle);
  });
