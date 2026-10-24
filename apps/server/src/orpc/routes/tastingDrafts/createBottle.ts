import { createId } from "@paralleldrive/cuid2";
import { db } from "@peated/server/db";
import { tastingDrafts } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import { assessBottleResolution } from "@peated/server/lib/bottleMatchingAutomation";
import { applyClassifierCreateDecision } from "@peated/server/lib/bottleReferenceResolution";
import { BottleAlreadyExistsError } from "@peated/server/lib/createBottle";
import {
  canPromotePhotoToCatalog,
  CatalogImageWarningSchema,
  promotePhotoToCatalogImage,
} from "@peated/server/lib/photoCatalogImage";
import { copyUploadByUrl } from "@peated/server/lib/uploads";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
  requireVerified,
} from "@peated/server/orpc/middleware";
import {
  PersistedTastingDraftIdentificationSchema,
  TastingDraftIdInputSchema,
  TastingDraftSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { TastingDraftSerializer } from "@peated/server/serializers/tastingDraft";
import { and, eq } from "drizzle-orm";
import path from "node:path";
import { z } from "zod";
import { lockMemberTastingDrafts } from "./shared";

const CreateTastingDraftBottleOutputSchema = z.object({
  draft: TastingDraftSchema,
  warnings: z
    .array(CatalogImageWarningSchema)
    .optional()
    .describe("Non-fatal warnings for side effects after Bottle creation"),
});
type CreateTastingDraftBottleOutput = z.infer<
  typeof CreateTastingDraftBottleOutputSchema
>;

export default procedure
  .use(requireAuth)
  .use(requireVerified)
  .use(requireTosAccepted)
  .route({
    method: "POST",
    path: "/tasting-drafts/{draft}/create-bottle",
    summary: "Create Bottle for tasting draft",
    description:
      "Create the new Bottle proposed by your draft's photo identification and choose it for the draft. Repeating the request returns the same Bottle. Returns `409 CONFLICT` with `data.bottle` when a different Bottle with the same identity already exists, so you can choose that one instead.",
    operationId: "createTastingDraftBottle",
  })
  .input(TastingDraftIdInputSchema)
  .output(CreateTastingDraftBottleOutputSchema)
  .handler(async ({ input, context, errors }) => {
    const user = context.user;
    const findDraft = async () =>
      await db.query.tastingDrafts.findFirst({
        where: and(
          eq(tastingDrafts.id, input.draft),
          eq(tastingDrafts.createdById, user.id),
        ),
      });

    const draft = await findDraft();
    if (!draft) {
      throw errors.NOT_FOUND({ message: "Draft not found." });
    }
    const result =
      draft.identificationStatus === "done" && draft.imageUrl
        ? PersistedTastingDraftIdentificationSchema.parse(draft.identification)
        : null;
    if (result?.action !== "create_bottle") {
      throw errors.BAD_REQUEST({
        message: "This draft has no new Bottle to confirm.",
      });
    }
    const { decision, photoSuitability } = result;
    // The automation rules may have changed since the draft was identified.
    if (
      !assessBottleResolution({ decision, readListingImage: true })
        .automationEligible
    ) {
      throw errors.BAD_REQUEST({
        message: "This Bottle needs review before it can be created.",
      });
    }
    const imageUrl = draft.imageUrl!;
    const actor = await getUserActor(user);

    // A retry reuses the Bottle the first request created, because its
    // identity matches exactly.
    let created: Awaited<ReturnType<typeof applyClassifierCreateDecision>>;
    try {
      created = await applyClassifierCreateDecision({
        createdByActorId: actor.id,
        decision,
      });
    } catch (err) {
      if (err instanceof BottleAlreadyExistsError) {
        throw errors.CONFLICT({
          message: err.message,
          data: { bottle: err.bottleId },
        });
      }
      throw err;
    }

    const updated = await db.transaction(async (tx) => {
      await lockMemberTastingDrafts(tx, user.id);
      const [row] = await tx
        .update(tastingDrafts)
        .set({ bottleId: created.bottleId, updatedAt: new Date() })
        .where(
          and(
            eq(tastingDrafts.id, draft.id),
            eq(tastingDrafts.createdById, user.id),
            // The proposal belongs to this photo.
            eq(tastingDrafts.imageUrl, imageUrl),
          ),
        )
        .returning();
      return row;
    });
    if (!updated) {
      if (!(await findDraft())) {
        throw errors.NOT_FOUND({ message: "Draft not found." });
      }
      throw errors.CONFLICT({
        message: "The draft's photo changed. Check the new suggestion.",
      });
    }

    const warning = canPromotePhotoToCatalog({
      createdBottle: created.createdBottle,
      photoSuitability,
    })
      ? await promotePhotoToCatalogImage({
          bottleId: created.bottleId,
          actorId: actor.id,
          // A new name, so the public URL does not reveal the private draft.
          copyImage: () =>
            copyUploadByUrl(
              imageUrl,
              `bottles/bottle-${created.bottleId}-${createId()}${path.posix.extname(imageUrl)}`,
            ),
          logContext: {
            tastingDraftId: draft.id,
            userId: user.id,
            createdBottle: created.createdBottle,
          },
        })
      : undefined;

    const response: CreateTastingDraftBottleOutput = {
      draft: await serialize(TastingDraftSerializer, updated, user),
    };
    if (warning) response.warnings = [warning];
    return response;
  });
