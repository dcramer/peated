import { call } from "@orpc/server";
import { db } from "@peated/server/db";
import { bottleReleases, bottles } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import { applyClassifierCreateDecision } from "@peated/server/lib/bottleReferenceResolution";
import { BottleAlreadyExistsError } from "@peated/server/lib/createBottle";
import { logError } from "@peated/server/lib/log";
import {
  copyPendingImageToBottle,
  copyPendingImageToBottleRelease,
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
import bottleReleasesDetails from "../bottleReleases/details";
import bottlesDetails from "../bottles/details";
import { isPhotoIdentificationCreateDecisionAutoCreatable } from "./photo-identification";

type AuthenticatedContext = Context & {
  user: NonNullable<Context["user"]>;
};

type CatalogImageApprovalTarget = "bottle" | "release";
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

const catalogImageWarningMessage: Record<CatalogImageApprovalTarget, string> = {
  bottle: "The bottle was created, but the public image was not saved.",
  release: "The release was created, but the public image was not saved.",
};

function buildCatalogImageWarning(
  target: CatalogImageApprovalTarget,
): CatalogImageWarning {
  return {
    code: "CATALOG_IMAGE_COPY_FAILED",
    message: catalogImageWarningMessage[target],
  };
}

/** Scan-created releases only promote suitable source photos, never classifier-proposed images. */
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

function getCatalogImageApprovalDestination({
  approvalTarget,
  decision,
  result,
  photoSuitability,
  pendingPurpose,
}: {
  approvalTarget: CatalogImageApprovalTarget;
  decision: CreateDecision;
  result: CreateDecisionResult;
  photoSuitability: PhotoSuitability;
  pendingPurpose: string;
}): { target: CatalogImageApprovalTarget; id: number } | null {
  if (
    pendingPurpose !== "photo_tasting_entry" ||
    photoSuitability.suitableAsBottleImage !== true
  ) {
    return null;
  }

  if (
    approvalTarget === "bottle" &&
    decision.action === "create_bottle" &&
    result.createdBottle
  ) {
    return { target: "bottle", id: result.bottleId };
  }

  if (
    approvalTarget === "release" &&
    (decision.action === "create_release" ||
      decision.action === "create_bottle_and_release" ||
      decision.action === "repair_parent_and_create_release") &&
    result.createdRelease &&
    result.releaseId
  ) {
    return { target: "release", id: result.releaseId };
  }

  return null;
}

function getDefaultCatalogImageApprovalTarget(
  decision: CreateDecision,
): CatalogImageApprovalTarget {
  return decision.action === "create_bottle" ? "bottle" : "release";
}

function logCatalogImageApprovalError(
  err: unknown,
  {
    destination,
    pendingImageId,
    userId,
    decision,
    result,
  }: {
    destination: { target: CatalogImageApprovalTarget; id: number };
    pendingImageId: string;
    userId: number;
    decision: CreateDecision;
    result: CreateDecisionResult;
  },
) {
  logError(err, {
    catalogImagePromotion: {
      target: destination.target,
      targetId: destination.id,
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
  destination,
  pendingImageId,
  userId,
  decision,
  result,
}: {
  destination: { target: CatalogImageApprovalTarget; id: number } | null;
  pendingImageId: string;
  userId: number;
  decision: CreateDecision;
  result: CreateDecisionResult;
}): Promise<CatalogImageWarning | undefined> {
  if (!destination) {
    return undefined;
  }

  try {
    if (destination.target === "bottle") {
      const [existingBottle] = await db
        .select({ imageUrl: bottles.imageUrl })
        .from(bottles)
        .where(eq(bottles.id, destination.id))
        .limit(1);
      if (!existingBottle || existingBottle.imageUrl) {
        return undefined;
      }

      const imageUrl = await copyPendingImageToBottle({
        id: pendingImageId,
        userId,
        purpose: "photo_tasting_entry",
        bottleId: destination.id,
      });

      const [updatedBottle] = await db
        .update(bottles)
        .set({ imageUrl })
        .where(and(eq(bottles.id, destination.id), isNull(bottles.imageUrl)))
        .returning({ id: bottles.id });
      if (!updatedBottle) {
        logCatalogImageApprovalError(
          new Error("Catalog image was copied but not saved to the bottle."),
          {
            destination,
            pendingImageId,
            userId,
            decision,
            result,
          },
        );
        return buildCatalogImageWarning(destination.target);
      }

      return undefined;
    }

    const [existingRelease] = await db
      .select({ imageUrl: bottleReleases.imageUrl })
      .from(bottleReleases)
      .where(eq(bottleReleases.id, destination.id))
      .limit(1);
    if (!existingRelease || existingRelease.imageUrl) {
      return undefined;
    }

    const imageUrl = await copyPendingImageToBottleRelease({
      id: pendingImageId,
      userId,
      purpose: "photo_tasting_entry",
      releaseId: destination.id,
    });

    const [updatedRelease] = await db
      .update(bottleReleases)
      .set({ imageUrl })
      .where(
        and(
          eq(bottleReleases.id, destination.id),
          isNull(bottleReleases.imageUrl),
        ),
      )
      .returning({ id: bottleReleases.id });
    if (!updatedRelease) {
      logCatalogImageApprovalError(
        new Error("Catalog image was copied but not saved to the release."),
        {
          destination,
          pendingImageId,
          userId,
          decision,
          result,
        },
      );
      return buildCatalogImageWarning(destination.target);
    }

    return undefined;
  } catch (err) {
    logCatalogImageApprovalError(err, {
      destination,
      pendingImageId,
      userId,
      decision,
      result,
    });

    return buildCatalogImageWarning(destination.target);
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
      "Create the bottle or release target from a reviewed photo identification result, with public catalog image promotion when the scan is suitable.",
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
      destination: getCatalogImageApprovalDestination({
        approvalTarget: getDefaultCatalogImageApprovalTarget(decision),
        decision,
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
      ...(warning ? { warnings: [warning] } : {}),
    };
  });
