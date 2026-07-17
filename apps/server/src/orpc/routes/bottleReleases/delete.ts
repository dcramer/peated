import { db } from "@peated/server/db";
import { bottleReleases } from "@peated/server/db/schema";
import {
  CatalogTargetResolutionError,
  resolveCatalogTargetForAssignment,
} from "@peated/server/lib/catalogTargets";
import { logInfo } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
import { z } from "zod";

/**
 * Measured refusal boundary because grouped retirement requires an explicit
 * Bottle merge.
 * Tasks 9.4 and 9.7 disable and then remove this legacy write surface.
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
    const [release] = await db
      .select({ id: bottleReleases.id, bottleId: bottleReleases.bottleId })
      .from(bottleReleases)
      .where(eq(bottleReleases.id, input.release))
      .limit(1);
    if (!release) {
      throw errors.NOT_FOUND({ message: "Release not found." });
    }

    let target;
    try {
      target = await resolveCatalogTargetForAssignment({
        kind: "legacy",
        bottleId: release.bottleId,
        releaseId: release.id,
        context: {
          caller: "bottleReleases.delete",
          operation: "require_concrete_bottle_merge",
        },
      });
    } catch (error) {
      if (error instanceof CatalogTargetResolutionError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }
    if (target.bottleId === null) {
      throw errors.CONFLICT({
        message: "BottleRelease promotion does not resolve to an exact Bottle.",
      });
    }

    logInfo("Legacy BottleRelease compatibility write refused", {
      extra: {
        event: "bottle_release.compatibility",
        access: "write",
        caller: "bottleReleases.delete",
        operation: "require_concrete_bottle_merge",
        outcome: "merge_required",
        legacyBottleId: release.bottleId,
        releaseId: release.id,
        replacementBottleId: target.bottleId,
        replacementTargetId: target.targetId,
      },
    });

    throw errors.CONFLICT({
      message: `BottleRelease ${release.id} maps to Bottle ${target.bottleId} through exact target ${target.targetId}; merge that Bottle into an explicit destination instead.`,
    });
  });
