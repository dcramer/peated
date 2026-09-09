import { db } from "@peated/server/db";
import {
  changes,
  externalReviews,
  memberReviews,
  tastings,
} from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { dispatchBottleStatsRecompute } from "@peated/server/lib/dispatchBottleStatsRecompute";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  AdminContentItemSchema,
  AdminContentModerationInputSchema,
} from "@peated/server/schemas";
import { eq } from "drizzle-orm";
import { dispatchTastingStatsRecompute } from "../../tastings/dispatchStatsRecompute";
import { contentDisplayName, getAdminContent } from "./data";

export default procedure
  .use(requireAdmin)
  .route({
    method: "PUT",
    path: "/admin/content/{kind}/{id}/moderation",
    summary: "Remove or restore review or tasting content",
    description:
      "Remove content from Peated or restore it. Requires an administrator and a reason.",
    operationId: "moderateAdminContent",
  })
  .input(AdminContentModerationInputSchema)
  .output(AdminContentItemSchema)
  .handler(async ({ input, context, errors }) => {
    const result = await db.transaction(async (tx) => {
      const table =
        input.kind === "member_review"
          ? memberReviews
          : input.kind === "external_review"
            ? externalReviews
            : tastings;
      const [locked] = await tx
        .select()
        .from(table)
        .where(eq(table.id, input.id))
        .limit(1)
        .for("update");
      if (!locked) {
        throw errors.NOT_FOUND({ message: "Content not found." });
      }

      if ((locked.removedAt !== null) === input.removed) {
        return { bottleId: locked.bottleId, changed: false };
      }

      const actor = await getUserActorForDatabase(tx, context.user);
      const action = input.removed ? "remove" : "restore";
      await tx.insert(changes).values({
        objectId: input.id,
        objectType: input.kind,
        type: "update",
        displayName: contentDisplayName(input.kind, input.id),
        actorId: actor.id,
        data: { moderation: { action, reason: input.reason } },
      });

      await tx
        .update(table)
        .set(
          input.removed
            ? {
                removedAt: new Date(),
                removedByActorId: actor.id,
                removalReason: input.reason,
              }
            : {
                removedAt: null,
                removedByActorId: null,
                removalReason: null,
              },
        )
        .where(eq(table.id, input.id));

      return { bottleId: locked.bottleId, changed: true };
    });

    if (result.changed && result.bottleId !== null) {
      if (input.kind === "tasting") {
        await dispatchTastingStatsRecompute(input.id, result.bottleId);
      } else {
        await dispatchBottleStatsRecompute(
          input.kind === "member_review" ? "memberReview" : "externalReview",
          input.id,
          result.bottleId,
        );
      }
    }

    const item = await getAdminContent(input.kind, input.id);
    if (!item) {
      throw errors.NOT_FOUND({ message: "Content not found." });
    }
    return item;
  });
