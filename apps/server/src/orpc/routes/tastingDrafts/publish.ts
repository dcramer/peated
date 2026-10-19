import { db } from "@peated/server/db";
import { tastingDrafts } from "@peated/server/db/schema";
import { copyUploadByUrl } from "@peated/server/lib/uploads";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import { dispatchTastingStatsRecompute } from "@peated/server/orpc/routes/tastings/dispatchStatsRecompute";
import {
  findTastingByIdempotencyKey,
  insertTasting,
} from "@peated/server/orpc/routes/tastings/insertTasting";
import { validateFriends } from "@peated/server/orpc/validators/friends";
import { validateTags } from "@peated/server/orpc/validators/tags";
import {
  BadgeAwardSchema,
  TastingDraftIdInputSchema,
  TastingSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BadgeAwardSerializer } from "@peated/server/serializers/badgeAward";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import { and, eq } from "drizzle-orm";
import path from "node:path";
import { z } from "zod";
import { lockMemberTastingDrafts, removeTastingDraftPhoto } from "./shared";

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "POST",
    path: "/tasting-drafts/{draft}/publish",
    summary: "Publish tasting draft",
    description:
      "Post one of your tasting drafts as a tasting and delete the draft. The draft needs a Bottle. The bottle hint is not kept. Repeating the request after it succeeded returns the same tasting with no awards; a draft that was never posted returns not found.",
    operationId: "publishTastingDraft",
  })
  .input(TastingDraftIdInputSchema)
  .output(
    z.object({
      tasting: TastingSchema,
      awards: z.array(BadgeAwardSchema),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const userId = context.user.id;

    const replay = async () => {
      const posted = await findTastingByIdempotencyKey(db, userId, input.draft);
      if (!posted) {
        throw errors.NOT_FOUND({ message: "Draft not found." });
      }
      return {
        tasting: await serialize(TastingSerializer, posted, context.user),
        awards: [],
      };
    };

    const [draft] = await db
      .select()
      .from(tastingDrafts)
      .where(
        and(
          eq(tastingDrafts.id, input.draft),
          eq(tastingDrafts.createdById, userId),
        ),
      );
    if (!draft) return await replay();

    const bottleId = draft.bottleId;
    if (!bottleId) {
      throw errors.BAD_REQUEST({
        message: "Choose a bottle before posting this draft.",
      });
    }
    const tags = await validateTags(draft.tags);
    await validateFriends(userId, draft.friends);

    // Copy outside the transaction to a path fixed by the draft ID, so a
    // retry overwrites the same file instead of leaving another copy.
    const imageUrl = draft.imageUrl
      ? await copyUploadByUrl(
          draft.imageUrl,
          `tastings/draft-${draft.id}${path.posix.extname(draft.imageUrl)}`,
        )
      : null;

    const published = await db.transaction(async (tx) => {
      await lockMemberTastingDrafts(tx, userId);

      const [locked] = await tx
        .select()
        .from(tastingDrafts)
        .where(
          and(
            eq(tastingDrafts.id, draft.id),
            eq(tastingDrafts.createdById, userId),
          ),
        )
        .for("update");
      // A concurrent publish finished first.
      if (!locked) return null;
      if (locked.updatedAt.getTime() !== draft.updatedAt.getTime()) {
        throw errors.CONFLICT({
          message: "The draft changed while posting. Try again.",
        });
      }

      const createdAt = new Date();
      const result = await insertTasting(
        tx,
        {
          bottleId,
          createdById: userId,
          createdAt,
          tastedAt: locked.tastedAt,
          idempotencyKey: locked.id,
          imageUrl,
          notes: locked.notes,
          ratingBand: locked.ratingBand,
          servingStyle: locked.servingStyle,
          color: locked.color,
          tags,
          friends: locked.friends,
        },
        context.user,
      );
      // A tasting already used this draft's ID, so the draft was not posted
      // here. Keep it rather than delete what the member wrote.
      if (result.replayed) return result;

      await tx.delete(tastingDrafts).where(eq(tastingDrafts.id, locked.id));
      return result;
    });

    if (!published) return await replay();
    if (published.replayed) {
      return {
        tasting: await serialize(
          TastingSerializer,
          published.tasting,
          context.user,
        ),
        awards: [],
      };
    }

    const { tasting, awards } = published;
    await dispatchTastingStatsRecompute(tasting.id, tasting.bottleId);
    if (draft.imageUrl) {
      await removeTastingDraftPhoto(draft.imageUrl, draft.id);
    }

    return {
      tasting: await serialize(TastingSerializer, tasting, context.user),
      awards: await serialize(BadgeAwardSerializer, awards, context.user),
    };
  });
