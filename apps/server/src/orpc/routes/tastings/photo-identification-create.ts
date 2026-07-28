/**
 * Confirms signed photo-identification create proposals without rerunning AI.
 * The route owns token/user validation, pending-upload ownership, durable
 * concrete Bottle creation, and API-facing conflict mapping.
 */
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
import {
  requireAuth,
  requireTosAccepted,
  requireVerified,
} from "@peated/server/orpc/middleware";
import { BottleSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { isPhotoIdentificationCreateDecisionAutoCreatable } from "./photo-identification";

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
      pendingImageId,
      userId,
      action: decision.action,
      bottleId: result.bottleId,
      createdBottle: result.createdBottle,
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
    summary: "Create Bottle from photo identification",
    description:
      "Create a Bottle from a reviewed photo identification result, with public catalog image promotion when the scan is suitable.",
    operationId: "createTastingBottleFromPhotoIdentification",
  })
  .input(
    z.object({
      createToken: z.string().trim().min(1),
    }),
  )
  .output(
    z.object({
      bottle: BottleSchema,
      warnings: z
        .array(CatalogImageWarningSchema)
        .optional()
        .describe("Non-fatal warnings for side effects after Bottle creation"),
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
    const { decision, photoSuitability } = createTokenPayload;
    if (decision.action !== "create_bottle") {
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

    const bottle = await db.query.bottles.findFirst({
      where: (bottles, { eq }) => eq(bottles.id, result.bottleId),
    });
    if (!bottle) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Created Bottle could not be loaded.",
      });
    }
    return {
      bottle: await serialize(BottleSerializer, bottle, user),
      ...(warning ? { warnings: [warning] } : {}),
    };
  });
