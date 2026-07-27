import { db } from "@peated/server/db";
import { bottleReleasePromotions } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import {
  LegacyBottleReleasePromotionError,
  resolveLegacyBottleReleasePromotion,
} from "@peated/server/lib/legacyBottleReleasePromotion";
import { logInfo } from "@peated/server/lib/log";
import {
  ConcreteBottleUpdateConflictError,
  ConcreteBottleUpdateGraphError,
  ConcreteBottleUpdateInputError,
  finalizeConcreteBottleUpdate,
  updateConcreteBottleInTransaction,
  type ConcreteBottleUpdateFinalizationManifest,
} from "@peated/server/lib/updateConcreteBottle";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleReleaseInputSchema, BottleSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
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
    if (input.imageUrl !== undefined && input.imageUrl !== null) {
      throw errors.BAD_REQUEST({
        message:
          "BottleRelease imageUrl is not supported by concrete Bottle updates.",
      });
    }

    let promotion: Awaited<
      ReturnType<typeof resolveLegacyBottleReleasePromotion>
    >;
    let updateManifest: ConcreteBottleUpdateFinalizationManifest;
    try {
      promotion = await resolveLegacyBottleReleasePromotion({
        releaseId: input.release,
        context: {
          access: "write",
          caller: "bottleReleases.update",
          operation: "update_concrete_bottle",
        },
      });

      const exact = {
        ...(input.edition !== undefined ? { edition: input.edition } : {}),
        ...(input.statedAge !== undefined
          ? { statedAge: input.statedAge }
          : {}),
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
      const actor = await getUserActor(context.user);
      updateManifest = await db.transaction(async (tx) => {
        const manifest = await updateConcreteBottleInTransaction(tx, {
          bottleId: promotion.bottle.id,
          input: { exact },
          user: context.user,
          actorId: actor.id,
          creationSource: "manual_entry",
        });

        // Canonical Bottle locks come first. Lock the compatibility evidence
        // only after them, then reject a concurrent promotion repoint.
        const [lockedPromotion] = await tx
          .select({
            promotedBottleId: bottleReleasePromotions.promotedBottleId,
            status: bottleReleasePromotions.status,
            completedAt: bottleReleasePromotions.completedAt,
          })
          .from(bottleReleasePromotions)
          .where(eq(bottleReleasePromotions.releaseId, promotion.release.id))
          .limit(1)
          .for("update");
        if (
          !lockedPromotion ||
          lockedPromotion.status !== "promoted" ||
          lockedPromotion.completedAt === null ||
          lockedPromotion.promotedBottleId !== manifest.bottle.id
        ) {
          throw new LegacyBottleReleasePromotionError(
            "promotion_integrity_mismatch",
            "BottleRelease promotion changed during the Bottle update.",
          );
        }

        return manifest;
      });
    } catch (error) {
      if (error instanceof LegacyBottleReleasePromotionError) {
        if (error.code === "release_not_found") {
          throw errors.NOT_FOUND({ message: error.message, cause: error });
        }
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      if (error instanceof ConcreteBottleUpdateInputError) {
        throw errors.BAD_REQUEST({ message: error.message, cause: error });
      }
      if (
        error instanceof ConcreteBottleUpdateGraphError &&
        error.code === "not_found"
      ) {
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }
      if (error instanceof ConcreteBottleUpdateGraphError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      if (error instanceof ConcreteBottleUpdateConflictError) {
        throw errors.CONFLICT({
          message: error.message,
          data:
            error.conflictingBottleId === null
              ? undefined
              : { bottle: error.conflictingBottleId },
          cause: error,
        });
      }
      throw error;
    }

    await finalizeConcreteBottleUpdate(updateManifest);
    const updated = await serialize(
      BottleSerializer,
      updateManifest.bottle,
      context.user,
      [],
      { includeGroupSummary: true },
    );

    logInfo("Legacy BottleRelease compatibility write", {
      extra: {
        event: "bottle_release.compatibility",
        access: "write",
        caller: "bottleReleases.update",
        operation: "update_concrete_bottle",
        legacyBottleId: promotion.release.bottleId,
        releaseId: promotion.release.id,
        replacementBottleId: updated.id,
      },
    });

    return updated;
  });
