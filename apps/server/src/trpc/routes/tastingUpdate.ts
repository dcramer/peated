import { db } from "@peated/server/db";
import type { Tasting } from "@peated/server/db/schema";
import {
  bottleTags,
  bottles,
  follows,
  tastings,
} from "@peated/server/db/schema";
import { arraysEqual } from "@peated/server/lib/equals";
import { TastingInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import { TRPCError } from "@trpc/server";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";

export default authedProcedure
  .input(
    TastingInputSchema.extend({
      tasting: z.number(),
    }).omit({ bottle: true, flight: true }),
  )
  .mutation(async function ({ input, ctx }) {
    const tasting = await db.query.tastings.findFirst({
      where: (tastings, { eq }) =>
        and(
          eq(tastings.id, input.tasting),
          eq(tastings.createdById, ctx.user.id),
        ),
      with: {
        bottle: true,
      },
    });
    if (!tasting) {
      throw new TRPCError({
        message: "Tasting not found.",
        code: "NOT_FOUND",
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
      input.flavorProfile !== undefined &&
      input.flavorProfile !== tasting.flavorProfile
    ) {
      tastingData.flavorProfile = input.flavorProfile;
    }
    if (
      input.servingStyle !== undefined &&
      input.servingStyle !== tasting.servingStyle
    ) {
      tastingData.servingStyle = input.servingStyle;
    }
    // TODO: needs tests yet
    if (input.friends && input.friends.length) {
      const friendUserIds = Array.from(new Set(input.friends));
      const matches = await db
        .select()
        .from(follows)
        .where(
          and(
            eq(follows.fromUserId, ctx.user.id),
            eq(follows.status, "following"),
            inArray(follows.toUserId, friendUserIds),
          ),
        );
      if (matches.length != friendUserIds.length) {
        throw new TRPCError({
          message: "Friends must all be active relationships.",
          code: "BAD_REQUEST",
        });
      }
      tastingData.friends = input.friends;
    }
    if (
      input.tags &&
      input.tags !== undefined &&
      !arraysEqual(input.tags, tasting.tags)
    ) {
      tastingData.tags = Array.from(
        new Set(input.tags.map((t) => t.toLowerCase())),
      );
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
          throw new TRPCError({
            message: "Tasting already exists.",
            code: "CONFLICT",
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
                count: sql<number>`${bottleTags.count} + 1`,
              },
            });
        }
      }

      // TODO;
      //   const badgeList = await checkBadges(tx, {
      //     ...tasting,
      //     bottle,
      //   });

      //   for (const badge of badgeList) {
      //     await tx
      //       .insert(badgeAwards)
      //       .values({
      //         badgeId: badge.id,
      //         userId: tasting.createdById,
      //         xp: 1,
      //         level: 1,
      //       })
      //       .onConflictDoUpdate({
      //         target: [badgeAwards.badgeId, badgeAwards.userId],
      //         set: {
      //           xp: sql`${badgeAwards.xp} + 1`,
      //           level: sql`(${badgeAwards.xp} + 1) / ${XP_PER_LEVEL} + 1`,
      //         },
      //       });
      //   }

      return newTasting;
    });

    if (!newTasting) {
      throw new TRPCError({
        message: "Unable to update tasting.",
        code: "INTERNAL_SERVER_ERROR",
      });
    }

    return await serialize(TastingSerializer, newTasting, ctx.user);
  });
