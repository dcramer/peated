import { db } from "@peated/server/db";
import type { Tasting } from "@peated/server/db/schema";
import {
  bottleTags,
  bottles,
  follows,
  tastings,
} from "@peated/server/db/schema";
import { arraysEqual } from "@peated/server/lib/equals";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware/auth";
import { validateTags } from "@peated/server/orpc/validators/tags";
import { TastingInputSchema, TastingSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";

const InputSchema = TastingInputSchema.partial()
  .extend({
    tasting: z.coerce.number(),
  })
  .omit({ bottle: true, flight: true });

export default procedure
  .use(requireAuth)
  .route({
    method: "PATCH",
    path: "/tastings/{tasting}",
    summary: "Update tasting",
    description:
      "Update tasting information including notes, rating, tags, and friends. Only the tasting creator can update",
  })
  .input(InputSchema)
  .output(TastingSchema)
  .handler(async function ({ input, context, errors }) {
    const user = context.user;

    const tasting = await db.query.tastings.findFirst({
      where: (tastings, { eq }) =>
        and(
          eq(tastings.id, input.tasting),
          eq(tastings.createdById, context.user.id),
        ),
      with: {
        bottle: true,
      },
    });
    if (!tasting) {
      throw errors.NOT_FOUND({
        message: "Tasting not found.",
      });
    }

    const tastingData: { [name: string]: any } = {};
    if (input.notes !== undefined && input.notes !== tasting.notes) {
      tastingData.notes = input.notes;
    }
    if (input.rating !== undefined && input.rating !== tasting.rating) {
      tastingData.rating = input.rating;
    }
    if (
      input.servingStyle !== undefined &&
      input.servingStyle !== tasting.servingStyle
    ) {
      tastingData.servingStyle = input.servingStyle;
    }
    if (input.color !== undefined && input.color !== tasting.color) {
      tastingData.color = input.color;
    }
    // TODO: needs tests yet
    if (input.friends && input.friends.length) {
      const friendUserIds = Array.from(new Set(input.friends));
      const matches = friendUserIds.length
        ? await db
            .select()
            .from(follows)
            .where(
              and(
                eq(follows.fromUserId, context.user.id),
                eq(follows.status, "following"),
                inArray(follows.toUserId, friendUserIds),
              ),
            )
        : [];
      if (matches.length != friendUserIds.length) {
        throw errors.BAD_REQUEST({
          message: "Friends must all be active relationships.",
        });
      }
      tastingData.friends = input.friends;
    }

    if (
      input.tags &&
      input.tags !== undefined &&
      !arraysEqual(input.tags, tasting.tags)
    ) {
      tastingData.tags = await validateTags(input.tags);
    }

    if (
      input.image === null &&
      (user?.admin || user?.mod || user?.id === tasting.createdById)
    ) {
      tastingData.imageUrl = null;
    }

    const newTasting = await db.transaction(async (tx) => {
      let newTasting: Tasting | undefined;
      try {
        newTasting = Object.values(tastingData).length
          ? (
              await tx
                .update(tastings)
                .set(tastingData)
                .where(eq(tastings.id, tasting.id))
                .returning()
            )[0]
          : tasting;
      } catch (err: any) {
        if (err?.code === "23505" && err?.constraint === "tasting_unq") {
          throw errors.CONFLICT({
            message: "Tasting already exists.",
            cause: err,
          });
        }
        throw err;
      }
      if (!newTasting) return;

      // rating was updated
      if (tastingData.rating !== undefined) {
        await tx
          .update(bottles)
          .set({
            avgRating: sql`(SELECT AVG(${tastings.rating}) FROM ${tastings} WHERE ${bottles.id} = ${tastings.bottleId})`,
          })
          .where(eq(bottles.id, newTasting.bottleId));
      }

      if (tastingData.tags !== undefined) {
        // TODO: we're being lazy - db access could be optimized
        for (const tag of tasting.tags) {
          await tx
            .update(bottleTags)
            .set({
              count: sql`${bottleTags.count} - 1`,
            })
            .where(
              and(
                eq(bottleTags.bottleId, tasting.bottleId),
                eq(bottleTags.tag, tag),
                gt(bottleTags.count, 0),
              ),
            );
        }
        for (const tag of newTasting.tags) {
          await tx
            .insert(bottleTags)
            .values({
              bottleId: newTasting.bottleId,
              tag,
              count: 1,
            })
            .onConflictDoUpdate({
              target: [bottleTags.bottleId, bottleTags.tag],
              set: {
                count: sql<string>`${bottleTags.count} + 1`,
              },
            });
        }
      }

      return newTasting;
    });

    if (!newTasting) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Unable to update tasting.",
      });
    }

    return await serialize(TastingSerializer, newTasting, context.user);
  });
