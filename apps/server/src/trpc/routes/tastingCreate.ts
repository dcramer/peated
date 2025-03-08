import { db } from "@peated/server/db";
import type { Flight, NewTasting, Tasting } from "@peated/server/db/schema";
import {
  bottleEditions,
  bottles,
  bottleTags,
  entities,
  flightBottles,
  flights,
  follows,
  tastings,
} from "@peated/server/db/schema";
import { awardAllBadgeXp } from "@peated/server/lib/badges";
import { notEmpty } from "@peated/server/lib/filter";
import { logError } from "@peated/server/lib/log";
import { TastingInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BadgeSerializer } from "@peated/server/serializers/badge";
import { BadgeAwardSerializer } from "@peated/server/serializers/badgeAward";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import { pushJob } from "@peated/server/worker/client";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { authedProcedure } from "..";
import { validateTags } from "../validators/tags";

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
        message: "Cannot identify bottle.",
        code: "BAD_REQUEST",
      });
    }

    if (input.edition) {
      const edition = await db.query.bottleEditions.findFirst({
        where: and(
          eq(bottleEditions.id, input.edition),
          eq(bottleEditions.bottleId, bottle.id),
        ),
      });
      if (!edition) {
        throw new TRPCError({
          message: "Cannot identify edition.",
          code: "BAD_REQUEST",
        });
      }
    }

    let flight: Flight | null = null;
    if (input.flight) {
      const flightResults = await db
        .select()
        .from(flights)
        .innerJoin(flightBottles, eq(flightBottles.flightId, flights.id))
        .where(
          and(
            eq(flights.publicId, input.flight),
            eq(flightBottles.bottleId, bottle.id),
          ),
        )
        .limit(1);
      if (flightResults.length !== 1) {
        throw new TRPCError({
          message: "Cannot identify flight.",
          code: "BAD_REQUEST",
        });
      }
      flight = flightResults[0].flight;
    }

    const data: NewTasting = {
      bottleId: bottle.id,
      editionId: input.edition || null,
      notes: input.notes || null,
      rating: input.rating || null,
      flightId: flight ? flight.id : null,
      servingStyle: input.servingStyle || null,
      color: input.color || null,
      tags: input.tags ? await validateTags(input.tags) : [],
      createdById: ctx.user.id,
    };
    if (input.createdAt) {
      data.createdAt = new Date(input.createdAt);
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

    const [tasting, awards] = await db.transaction(async (tx) => {
      let tasting: Tasting | undefined;
      try {
        [tasting] = await tx.insert(tastings).values(data).returning();
      } catch (err: any) {
        if (err?.code === "23505" && err?.constraint === "tasting_unq") {
          throw new TRPCError({
            message: "Tasting already exists.",
            code: "CONFLICT",
            cause: err,
          });
        }
        throw err;
      }
      if (!tasting) return [];

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

      const awards = await awardAllBadgeXp(tx, {
        ...tasting,
        bottle,
      });

      for (const award of awards) {
        Object.assign(award, {
          badge: await serialize(BadgeSerializer, award.badge, ctx.user),
        });
      }

      return [tasting, awards];
    });

    if (!tasting) {
      throw new TRPCError({
        message: "Unable to create tasting.",
        code: "INTERNAL_SERVER_ERROR",
      });
    }

    if (!ctx.user.private) {
      try {
        await pushJob("NotifyDiscordOnTasting", { tastingId: tasting.id });
      } catch (err) {
        logError(err, {
          tasting: {
            id: tasting.id,
          },
        });
      }
    }

    return {
      tasting: await serialize(TastingSerializer, tasting, ctx.user),
      // TODO:
      awards: await serialize(BadgeAwardSerializer, awards || [], ctx.user),
    };
  });
