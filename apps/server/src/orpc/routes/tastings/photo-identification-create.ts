/**
 * Confirms signed photo-identification create proposals without rerunning AI.
 * The route owns token/user validation, pending-upload ownership, durable
 * Bottle creation, and API-facing conflict mapping.
 */
import { db } from "@peated/server/db";
import { getUserActor } from "@peated/server/lib/actors";
import { assessBottleResolution } from "@peated/server/lib/bottleMatchingAutomation";
import { applyClassifierCreateDecision } from "@peated/server/lib/bottleReferenceResolution";
import { BottleAlreadyExistsError } from "@peated/server/lib/createBottle";
import {
  copyPendingImageToBottle,
  getUsablePendingUpload,
  PendingUploadError,
} from "@peated/server/lib/pendingUploads";
import {
  canPromotePhotoToCatalog,
  CatalogImageWarningSchema,
  promotePhotoToCatalogImage,
} from "@peated/server/lib/photoCatalogImage";
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
import { z } from "zod";

const PhotoIdentificationCreateOutputSchema = z.object({
  bottle: BottleSchema,
  warnings: z
    .array(CatalogImageWarningSchema)
    .optional()
    .describe("Non-fatal warnings for side effects after Bottle creation"),
});
type PhotoIdentificationCreateOutput = z.infer<
  typeof PhotoIdentificationCreateOutputSchema
>;

type CreateDecisionResult = Awaited<
  ReturnType<typeof applyClassifierCreateDecision>
>;

export function createPhotoIdentificationCreateProcedure(
  copyImage: typeof copyPendingImageToBottle = copyPendingImageToBottle,
) {
  return procedure
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
    .output(PhotoIdentificationCreateOutputSchema)
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
      if (
        !assessBottleResolution({ decision, readListingImage: true })
          .automationEligible
      ) {
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

      const warning =
        pendingImage.purpose === "photo_tasting_entry" &&
        canPromotePhotoToCatalog({
          createdBottle: result.createdBottle,
          photoSuitability,
        })
          ? await promotePhotoToCatalogImage({
              bottleId: result.bottleId,
              actorId: actor.id,
              copyImage: () =>
                copyImage({
                  id: pendingImage.id,
                  userId: user.id,
                  purpose: "photo_tasting_entry",
                  bottleId: result.bottleId,
                }),
              logContext: {
                pendingImageId: pendingImage.id,
                userId: user.id,
                createdBottle: result.createdBottle,
              },
            })
          : undefined;

      const bottle = await db.query.bottles.findFirst({
        where: (bottles, { eq }) => eq(bottles.id, result.bottleId),
      });
      if (!bottle) {
        throw errors.INTERNAL_SERVER_ERROR({
          message: "Created Bottle could not be loaded.",
        });
      }
      const serializedBottle = await serialize(
        BottleSerializer,
        bottle,
        user,
        [],
        {
          includeGroupSummary: true,
        },
      );
      const response: PhotoIdentificationCreateOutput = {
        bottle: serializedBottle,
      };
      if (warning) response.warnings = [warning];
      return response;
    });
}

export default createPhotoIdentificationCreateProcedure();
