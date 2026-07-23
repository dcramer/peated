import { db } from "@peated/server/db";
import { bottleReleases, bottles } from "@peated/server/db/schema";
import {
  CatalogTargetResolutionError,
  loadCatalogTargetByLegacyReference,
} from "@peated/server/lib/catalogTargets";
import { procedure } from "@peated/server/orpc";
import { BottleReleaseSchema, detailsResponse } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { eq } from "drizzle-orm";
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
    const [release] = await db
      .select({ id: bottleReleases.id, bottleId: bottleReleases.bottleId })
      .from(bottleReleases)
      .where(eq(bottleReleases.id, input.release))
      .limit(1);

    if (!release) {
      throw errors.NOT_FOUND({
        message: "Release not found.",
      });
    }

    let target;
    try {
      target = await loadCatalogTargetByLegacyReference(
        { bottleId: release.bottleId, releaseId: release.id },
        {
          actor: null,
          permissions: { canReadCatalogIdentity: true },
          caller: "bottleReleases.details",
          operation: "read_promoted_bottle",
        },
      );
    } catch (error) {
      if (error instanceof CatalogTargetResolutionError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }

    if (target.kind !== "bottle") {
      throw errors.CONFLICT({
        message: "BottleRelease does not resolve to an exact Bottle target.",
      });
    }

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, target.bottle.id))
      .limit(1);
    if (!bottle) {
      throw errors.CONFLICT({
        message: "Promoted Bottle is unavailable.",
      });
    }

    const serializedBottle = await serialize(
      BottleSerializer,
      bottle,
      context.user,
    );
    return projectLegacyBottleRelease(release, serializedBottle);
  });
