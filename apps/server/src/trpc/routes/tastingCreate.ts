import { XP_PER_LEVEL } from "@peated/server/constants";
import { db } from "@peated/server/db";
import type { NewTasting, Tasting } from "@peated/server/db/schema";
import {
  badgeAwards,
  bottleTags,
  bottles,
  entities,
  follows,
  tastings,
} from "@peated/server/db/schema";
import pushJob from "@peated/server/jobs";
import { checkBadges } from "@peated/server/lib/badges";
import { isDistantFuture, isDistantPast } from "@peated/server/lib/dates";
import { notEmpty } from "@peated/server/lib/filter";
import { TastingInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { authedProcedure } from "..";

export default authedProcedure
  .input(TastingInputSchema)
  .mutation(async function ({ input, ctx }) {
    const bottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, input.bottle),
      with: {
        bottler: true,
        brand: true,
        bottlesToDistillers: {
          with: {
            distiller: true,
          },
        },
      },
    });
    if (!bottle) {
      throw new TRPCError({
        message: "Cannot identity bottle.",
        code: "BAD_REQUEST",
      });
    }

    const data: NewTasting = {
      bottleId: bottle.id,
      notes: input.notes || null,
      rating: input.rating || null,
      tags: input.tags
        ? Array.from(new Set(input.tags.map((t) => t.toLowerCase())))
        : [],
      createdById: ctx.user.id,
    };
    if (input.createdAt) {
      data.createdAt = new Date(input.createdAt);
      if (isDistantFuture(data.createdAt, 60 * 5)) {
        throw new TRPCError({
          message: "createdAt too far in future.",
          code: "BAD_REQUEST",
        });
      }
      if (isDistantPast(data.createdAt, 60 * 60 * 24 * 7)) {
        throw new TRPCError({
          message: "createdAt too far in the past.",
          code: "BAD_REQUEST",
        });
      }
    }

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
      data.friends = input.friends;
    }

    const tasting = await db.transaction(async (tx) => {
      let tasting: Tasting | undefined;
      try {
        [tasting] = await tx.insert(tastings).values(data).returning();
      } catch (err: any) {
        if (err?.code === "23505" && err?.constraint === "tasting_unq") {
          throw new TRPCError({
            message: "Tasting already exists.",
            code: "CONFLICT",
          });
        }
        throw err;
      }
      if (!tasting) return;

      await tx
        .update(bottles)
        .set({
          totalTastings: sql`${bottles.totalTastings} + 1`,
          avgRating: sql`(SELECT AVG(${tastings.rating}) FROM ${tastings} WHERE ${bottles.id} = ${tastings.bottleId})`,
        })
        .where(eq(bottles.id, bottle.id));

      const distillerIds = bottle.bottlesToDistillers.map((d) => d.distillerId);

      await tx
        .update(entities)
        .set({ totalTastings: sql`${entities.totalTastings} + 1` })
        .where(
          inArray(
            entities.id,
            Array.from(
              new Set(
                [bottle.brandId, ...distillerIds, bottle.bottlerId].filter(
                  notEmpty,
                ),
              ),
            ),
          ),
        );

      for (const tag of tasting.tags) {
        await tx
          .insert(bottleTags)
          .values({
            bottleId: bottle.id,
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

      const badgeList = await checkBadges(tx, {
        ...tasting,
        bottle,
      });

      for (const badge of badgeList) {
        await tx
          .insert(badgeAwards)
          .values({
            badgeId: badge.id,
            userId: tasting.createdById,
            xp: 1,
            level: 1,
          })
          .onConflictDoUpdate({
            target: [badgeAwards.badgeId, badgeAwards.userId],
            set: {
              xp: sql`${badgeAwards.xp} + 1`,
              level: sql`(${badgeAwards.xp} + 1) / ${XP_PER_LEVEL} + 1`,
            },
          });
      }

      return tasting;
    });

    if (!tasting) {
      throw new TRPCError({
        message: "Unable to create tasting.",
        code: "INTERNAL_SERVER_ERROR",
      });
    }

    if (!ctx.user.private)
      await pushJob("NotifyDiscordOnTasting", { tastingId: tasting.id });

    return await serialize(TastingSerializer, tasting, ctx.user);
  });
