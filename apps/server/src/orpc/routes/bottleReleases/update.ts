import { call } from "@orpc/server";
import { db } from "@peated/server/db";
import { bottleReleases } from "@peated/server/db/schema";
import {
  CatalogTargetResolutionError,
  resolveCatalogTargetForAssignment,
} from "@peated/server/lib/catalogTargets";
import { logInfo } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import updateBottle from "@peated/server/orpc/routes/bottles/update";
import { BottleReleaseInputSchema, BottleSchema } from "@peated/server/schemas";
import { eq } from "drizzle-orm";
import { z } from "zod";

// PATCH must distinguish omitted fields from explicit null clears.
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
 * Measured compatibility over the promoted Bottle's canonical exact update.
 * Task 5.8 keeps this translation-only; tasks 8.6 and 8.7 disable and then
 * remove the legacy write surface after compatibility traffic is reviewed.
 */
export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/bottle-releases/{release}",
    summary: "Update bottle bottling",
    description:
      "Update bottling information including edition, vintage, and cask details. Requires moderator privileges",
    spec: (spec) => ({
      ...spec,
      operationId: "updateBottleRelease",
    }),
  })
  .input(InputSchema)
  .output(BottleSchema)
  .handler(async function ({ input, context, errors }) {
    const [release] = await db
      .select({ id: bottleReleases.id, bottleId: bottleReleases.bottleId })
      .from(bottleReleases)
      .where(eq(bottleReleases.id, input.release))
      .limit(1);
    if (!release) {
      throw errors.NOT_FOUND({ message: "Release not found." });
    }

    if (input.imageUrl !== undefined && input.imageUrl !== null) {
      throw errors.BAD_REQUEST({
        message:
          "BottleRelease imageUrl is not supported by concrete Bottle updates.",
      });
    }

    let target;
    try {
      target = await resolveCatalogTargetForAssignment({
        kind: "legacy",
        bottleId: release.bottleId,
        releaseId: release.id,
        context: {
          caller: "bottleReleases.update",
          operation: "update_concrete_bottle",
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

    const exact = {
      ...(input.edition !== undefined ? { edition: input.edition } : {}),
      ...(input.statedAge !== undefined ? { statedAge: input.statedAge } : {}),
      ...(input.abv !== undefined ? { abv: input.abv } : {}),
      ...(input.caskStrength !== undefined
        ? { caskStrength: input.caskStrength }
        : {}),
      ...(input.singleCask !== undefined
        ? { singleCask: input.singleCask }
        : {}),
      ...(input.vintageYear !== undefined
        ? { vintageYear: input.vintageYear }
        : {}),
      ...(input.releaseYear !== undefined
        ? { releaseYear: input.releaseYear }
        : {}),
      ...(input.caskType !== undefined ? { caskType: input.caskType } : {}),
      ...(input.caskSize !== undefined ? { caskSize: input.caskSize } : {}),
      ...(input.caskFill !== undefined ? { caskFill: input.caskFill } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.tastingNotes !== undefined
        ? { tastingNotes: input.tastingNotes }
        : {}),
      ...(input.imageUrl === null ? { image: null } : {}),
    };
    const updated = await call(
      updateBottle,
      { bottle: target.bottleId, exact },
      { context },
    );

    logInfo("Legacy BottleRelease compatibility write", {
      extra: {
        event: "bottle_release.compatibility",
        access: "write",
        caller: "bottleReleases.update",
        operation: "update_concrete_bottle",
        legacyBottleId: release.bottleId,
        releaseId: release.id,
        replacementBottleId: updated.id,
      },
    });

    return updated;
  });
