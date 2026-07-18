/**
 * Confirms signed photo-identification create proposals without rerunning AI.
 * The route owns token/user validation, pending-upload ownership, durable
 * concrete Bottle creation, and API-facing conflict mapping.
 */
import { call } from "@orpc/server";
import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import { applyClassifierCreateDecision } from "@peated/server/lib/bottleReferenceResolution";
import { BottleAlreadyExistsError } from "@peated/server/lib/createBottle";
import { logError } from "@peated/server/lib/log";
import {
  copyPendingImageToBottle,
  getUsablePendingUpload,
  PendingUploadError,
} from "@peated/server/lib/pendingUploads";
import { verifyPhotoIdentificationCreateToken } from "@peated/server/lib/photoIdentificationCreateToken";
import { procedure } from "@peated/server/orpc";
import type { Context } from "@peated/server/orpc/context";
import {
  requireAuth,
  requireTosAccepted,
  requireVerified,
} from "@peated/server/orpc/middleware";
import { BottleReleaseSchema, BottleSchema } from "@peated/server/schemas";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import bottlesDetails from "../bottles/details";
import { isPhotoIdentificationCreateDecisionAutoCreatable } from "./photo-identification";

type AuthenticatedContext = Context & {
  user: NonNullable<Context["user"]>;
};

const CatalogImageWarningSchema = z.object({
  code: z.literal("CATALOG_IMAGE_COPY_FAILED"),
  message: z.string(),
});
type CatalogImageWarning = z.infer<typeof CatalogImageWarningSchema>;

type CreateDecisionResult = Awaited<
  ReturnType<typeof applyClassifierCreateDecision>
>;
type CreateDecision = Parameters<
  typeof applyClassifierCreateDecision
>[0]["decision"];
type PhotoSuitability = Awaited<
  ReturnType<typeof verifyPhotoIdentificationCreateToken>
>["photoSuitability"];

function buildCatalogImageWarning(): CatalogImageWarning {
  return {
    code: "CATALOG_IMAGE_COPY_FAILED",
    message: "The bottle was created, but the public image was not saved.",
  };
}

/** Classifier-proposed image URLs never bypass the pending-upload boundary. */
function stripUnapprovedCatalogImages(
  decision: CreateDecision,
): CreateDecision {
  if (decision.action === "create_release") {
    return {
      ...decision,
      proposedRelease: {
        ...decision.proposedRelease,
        imageUrl: null,
      },
    };
  }

  if (decision.action === "create_bottle_and_release") {
    return {
      ...decision,
      proposedRelease: {
        ...decision.proposedRelease,
        imageUrl: null,
      },
    };
  }

  if (decision.action === "repair_parent_and_create_release") {
    return {
      ...decision,
      proposedRelease: {
        ...decision.proposedRelease,
        imageUrl: null,
      },
    };
  }

  return decision;
}

function shouldPromoteCatalogImage({
  result,
  photoSuitability,
  pendingPurpose,
}: {
  result: CreateDecisionResult;
  photoSuitability: PhotoSuitability;
  pendingPurpose: string;
}) {
  if (
    pendingPurpose !== "photo_tasting_entry" ||
    photoSuitability.suitableAsBottleImage !== true ||
    !result.createdBottle
  ) {
    return false;
  }
  return true;
}

function logCatalogImageApprovalError(
  err: unknown,
  {
    pendingImageId,
    userId,
    decision,
    result,
  }: {
    pendingImageId: string;
    userId: number;
    decision: CreateDecision;
    result: CreateDecisionResult;
  },
) {
  logError(err, {
    catalogImagePromotion: {
      target: "bottle",
      targetId: result.targetId,
      pendingImageId,
      userId,
      action: decision.action,
      bottleId: result.bottleId,
      releaseId: result.releaseId,
      createdBottle: result.createdBottle,
      createdRelease: result.createdRelease,
    },
  });
}

async function applyCatalogImageApproval({
  promote,
  pendingImageId,
  userId,
  decision,
  result,
}: {
  promote: boolean;
  pendingImageId: string;
  userId: number;
  decision: CreateDecision;
  result: CreateDecisionResult;
}): Promise<CatalogImageWarning | undefined> {
  if (!promote) {
    return undefined;
  }

  try {
    const [existingBottle] = await db
      .select({ imageUrl: bottles.imageUrl })
      .from(bottles)
      .where(eq(bottles.id, result.bottleId))
      .limit(1);
    if (!existingBottle || existingBottle.imageUrl) {
      return undefined;
    }

    const imageUrl = await copyPendingImageToBottle({
      id: pendingImageId,
      userId,
      purpose: "photo_tasting_entry",
      bottleId: result.bottleId,
    });

    const [updatedBottle] = await db
      .update(bottles)
      .set({ imageUrl })
      .where(and(eq(bottles.id, result.bottleId), isNull(bottles.imageUrl)))
      .returning({ id: bottles.id });
    if (!updatedBottle) {
      logCatalogImageApprovalError(
        new Error("Catalog image was copied but not saved to the bottle."),
        {
          pendingImageId,
          userId,
          decision,
          result,
        },
      );
      return buildCatalogImageWarning();
    }

    return undefined;
  } catch (err) {
    logCatalogImageApprovalError(err, {
      pendingImageId,
      userId,
      decision,
      result,
    });

    return buildCatalogImageWarning();
  }
}

export default procedure
  .use(requireAuth)
  .use(requireVerified)
  .use(requireTosAccepted)
  .route({
    method: "POST",
    path: "/tastings/photo-identification-create",
    summary: "Create bottle target from photo identification",
    description:
      "Create a concrete Bottle target from a reviewed photo identification result, with public catalog image promotion when the scan is suitable.",
    operationId: "createTastingBottleTargetFromPhotoIdentification",
  })
  .input(
    z.object({
      createToken: z.string().trim().min(1),
    }),
  )
  .output(
    z.object({
      bottle: BottleSchema,
      release: BottleReleaseSchema.nullable(),
      warnings: z
        .array(CatalogImageWarningSchema)
        .optional()
        .describe("Non-fatal warnings for side effects after target creation"),
    }),
  )
  .handler(async function ({ input, context, errors }) {
    const user = context.user;
    if (!user) {
      throw errors.UNAUTHORIZED();
    }

    let createTokenPayload: Awaited<
      ReturnType<typeof verifyPhotoIdentificationCreateToken>
    >;
    try {
      createTokenPayload = await verifyPhotoIdentificationCreateToken(
        input.createToken,
      );
    } catch (err) {
      throw errors.BAD_REQUEST({
        message: "Photo identification create proposal is no longer valid.",
        cause: err,
      });
    }

    if (createTokenPayload.userId !== user.id) {
      throw errors.BAD_REQUEST({
        message: "Photo identification create proposal is no longer valid.",
      });
    }

    let pendingImage;
    try {
      pendingImage = await getUsablePendingUpload({
        id: createTokenPayload.pendingImageId,
        userId: user.id,
      });
    } catch (err) {
      if (err instanceof PendingUploadError) {
        throw errors.BAD_REQUEST({
          message: err.message || "Pending photo is no longer available.",
        });
      }
      throw err;
    }
    const {
      candidateBottleIds,
      decision: createDecision,
      photoSuitability,
    } = createTokenPayload;
    let decision = createDecision;
    if (
      decision.action !== "create_bottle" &&
      decision.action !== "create_release" &&
      decision.action !== "create_bottle_and_release" &&
      decision.action !== "repair_parent_and_create_release"
    ) {
      throw errors.BAD_REQUEST({
        message: "Photo identification result is not a create proposal.",
      });
    }
    if (!isPhotoIdentificationCreateDecisionAutoCreatable(decision)) {
      throw errors.BAD_REQUEST({
        message:
          "Photo identification result needs review before creating a bottle.",
      });
    }
    if (
      (decision.action === "create_release" ||
        decision.action === "repair_parent_and_create_release") &&
      !candidateBottleIds.includes(decision.parentBottleId)
    ) {
      throw errors.BAD_REQUEST({
        message: "Photo identification result is not a valid create proposal.",
      });
    }
    decision = stripUnapprovedCatalogImages(decision);

    const authenticatedContext: AuthenticatedContext = {
      ...context,
      user,
    };
    const actor = await getUserActor(user);

    let result: CreateDecisionResult;
    try {
      result = await applyClassifierCreateDecision({
        createdByActorId: actor.id,
        decision,
        user,
      });
    } catch (err) {
      if (err instanceof BottleAlreadyExistsError) {
        throw errors.CONFLICT({
          message: err.message,
          data: {
            bottle: err.bottleId,
          },
        });
      }

      throw err;
    }

    const warning = await applyCatalogImageApproval({
      promote: shouldPromoteCatalogImage({
        result,
        photoSuitability,
        pendingPurpose: pendingImage.purpose,
      }),
      pendingImageId: pendingImage.id,
      userId: user.id,
      decision,
      result,
    });

    const bottle = await call(
      bottlesDetails,
      { bottle: result.bottleId },
      { context: authenticatedContext },
    );
    return {
      bottle,
      release: null,
      ...(warning ? { warnings: [warning] } : {}),
    };
  });
