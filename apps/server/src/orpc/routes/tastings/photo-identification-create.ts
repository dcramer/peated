import { call } from "@orpc/server";
import { applyClassifierCreateDecision } from "@peated/server/lib/bottleReferenceResolution";
import {
  PendingUploadError,
  getUsablePendingUpload,
} from "@peated/server/lib/pendingUploads";
import { procedure } from "@peated/server/orpc";
import type { Context } from "@peated/server/orpc/context";
import {
  requireAuth,
  requireTosAccepted,
  requireVerified,
} from "@peated/server/orpc/middleware";
import { BottleReleaseSchema, BottleSchema } from "@peated/server/schemas";
import { z } from "zod";
import bottleReleasesDetails from "../bottleReleases/details";
import bottlesDetails from "../bottles/details";
import { identifyPendingImage } from "./photo-identification";

type AuthenticatedContext = Context & {
  user: NonNullable<Context["user"]>;
};

export default procedure
  .use(requireAuth)
  .use(requireVerified)
  .use(requireTosAccepted)
  .route({
    method: "POST",
    path: "/tastings/photo-identification-create",
    summary: "Create bottle target from photo identification",
    description:
      "Create the bottle or release target from a reviewed photo identification result before recording a tasting.",
    operationId: "createTastingBottleTargetFromPhotoIdentification",
  })
  .input(
    z.object({
      pendingImageId: z.string().trim().min(1),
    }),
  )
  .output(
    z.object({
      bottle: BottleSchema,
      release: BottleReleaseSchema.nullable(),
    }),
  )
  .handler(async function ({ input, context, errors }) {
    const user = context.user;
    if (!user) {
      throw errors.UNAUTHORIZED();
    }

    let pendingImage;
    try {
      pendingImage = await getUsablePendingUpload({
        id: input.pendingImageId,
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
    const { classification } = await identifyPendingImage({ pendingImage });

    if (classification.status !== "classified") {
      throw errors.BAD_REQUEST({
        message: "Photo identification result is not a create proposal.",
      });
    }

    const decision = classification.decision;
    if (
      decision.action !== "create_bottle" &&
      decision.action !== "create_release" &&
      decision.action !== "create_bottle_and_release"
    ) {
      throw errors.BAD_REQUEST({
        message: "Photo identification result is not a create proposal.",
      });
    }

    const authenticatedContext: AuthenticatedContext = {
      ...context,
      user,
    };

    const result = await applyClassifierCreateDecision({
      decision,
      user,
    });

    const bottle = await call(
      bottlesDetails,
      { bottle: result.bottleId },
      { context: authenticatedContext },
    );
    const release = result.releaseId
      ? await call(
          bottleReleasesDetails,
          { release: result.releaseId },
          { context: authenticatedContext },
        )
      : null;

    return {
      bottle,
      release,
    };
  });
