import { call } from "@orpc/server";
import { db } from "@peated/server/db";
import { bottleReleases, bottles } from "@peated/server/db/schema";
import { applyClassifierCreateDecision } from "@peated/server/lib/bottleReferenceResolution";
import { logError } from "@peated/server/lib/log";
import {
  copyPendingImageToBottle,
  copyPendingImageToBottleRelease,
  getUsablePendingUpload,
  PendingUploadError,
} from "@peated/server/lib/pendingUploads";
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
import {
  identifyPendingImage,
  isPhotoIdentificationCreateDecisionAutoCreatable,
} from "./photo-identification";

type AuthenticatedContext = Context & {
  user: NonNullable<Context["user"]>;
};

const CatalogImageApprovalTargetSchema = z.enum(["bottle", "release"]);
type CatalogImageApprovalTarget = z.infer<
  typeof CatalogImageApprovalTargetSchema
>;
const CatalogImageApprovalSchema = z.object({
  target: CatalogImageApprovalTargetSchema,
});
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
type ImageEvidence = Awaited<
  ReturnType<typeof identifyPendingImage>
>["imageEvidence"];

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

/** Catalog image approval is the only image promotion path for scan-created releases. */
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

  return decision;
}

function getCatalogImageApprovalDestination({
  approvalTarget,
  decision,
  result,
  imageEvidence,
  pendingPurpose,
}: {
  approvalTarget: CatalogImageApprovalTarget | null | undefined;
  decision: CreateDecision;
  result: CreateDecisionResult;
  imageEvidence: ImageEvidence;
  pendingPurpose: string;
}): { target: CatalogImageApprovalTarget; id: number } | null {
  if (!approvalTarget) {
    return null;
  }

  if (
    pendingPurpose !== "photo_tasting_entry" ||
    imageEvidence.photoSuitability.suitableAsBottleImage !== true
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
      decision.action === "create_bottle_and_release") &&
    result.createdRelease &&
    result.releaseId
  ) {
    return { target: "release", id: result.releaseId };
  }

  return null;
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
    catalogImageApproval: {
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
      "Create the bottle or release target from a reviewed photo identification result, with optional approved public catalog image promotion.",
    operationId: "createTastingBottleTargetFromPhotoIdentification",
  })
  .input(
    z.object({
      pendingImageId: z.string().trim().min(1),
      catalogImageApproval: CatalogImageApprovalSchema.nullish().describe(
        "Approved public catalog image destination for the pending scan",
      ),
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
    const { imageEvidence, classification } = await identifyPendingImage({
      pendingImage,
    });

    if (classification.status !== "classified") {
      throw errors.BAD_REQUEST({
        message: "Photo identification result is not a create proposal.",
      });
    }

    let decision = classification.decision;
    if (
      decision.action !== "create_bottle" &&
      decision.action !== "create_release" &&
      decision.action !== "create_bottle_and_release"
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
    decision = stripUnapprovedCatalogImages(decision);

    const authenticatedContext: AuthenticatedContext = {
      ...context,
      user,
    };

    const result = await applyClassifierCreateDecision({
      decision,
      user,
    });

    const warning = await applyCatalogImageApproval({
      destination: getCatalogImageApprovalDestination({
        approvalTarget: input.catalogImageApproval?.target,
        decision,
        result,
        imageEvidence,
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
