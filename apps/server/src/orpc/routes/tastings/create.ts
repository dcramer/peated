import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import type { Flight, NewTasting, Tasting } from "@peated/server/db/schema";
import {
  bottleReleases,
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
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware/auth";
import { validateTags } from "@peated/server/orpc/validators/tags";
import {
  BadgeAwardSchema,
  TastingInputSchema,
  TastingSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BadgeSerializer } from "@peated/server/serializers/badge";
import { BadgeAwardSerializer } from "@peated/server/serializers/badgeAward";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import { pushJob } from "@peated/server/worker/client";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "POST",
    path: "/tastings",
    summary: "Create tasting",
    description:
      "Create a new tasting entry for a bottle with notes, rating, and optional metadata like flight and friends",
    operationId: "createTasting",
  })
  .input(TastingInputSchema)
  .output(
    z.object({
      tasting: TastingSchema,
      awards: z.array(BadgeAwardSchema),
    }),
  )
  .handler(async function ({ input, context, errors }) {
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
      throw errors.BAD_REQUEST({
        message: "Cannot identify bottle.",
      });
    }

    if (input.release) {
      const release = await db.query.bottleReleases.findFirst({
        where: and(
          eq(bottleReleases.id, input.release),
          eq(bottleReleases.bottleId, bottle.id),
        ),
      });
      if (!release) {
        throw errors.BAD_REQUEST({
          message: "Cannot identify release.",
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
        throw errors.BAD_REQUEST({
          message: "Cannot identify flight.",
        });
      }
      flight = flightResults[0].flight;
    }

    const data: NewTasting = {
      bottleId: bottle.id,
      releaseId: input.release || null,
      notes: input.notes || null,
      rating: input.rating || null,
      flightId: flight ? flight.id : null,
      servingStyle: input.servingStyle || null,
      color: input.color || null,
      tags: input.tags ? await validateTags(input.tags) : [],
      createdById: context.user.id,
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
            eq(follows.fromUserId, context.user.id),
            eq(follows.status, "following"),
            inArray(follows.toUserId, friendUserIds),
          ),
        );
      if (matches.length != friendUserIds.length) {
        throw errors.BAD_REQUEST({
          message: "Friends must all be active relationships.",
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
          throw errors.CONFLICT({
            message: "Tasting already exists.",
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
          avgRating: sql`(SELECT AVG(${tastings.ratingLegacy}) FROM ${tastings} WHERE ${bottles.id} = ${tastings.bottleId})`,
        })
        .where(eq(bottles.id, bottle.id));

      if (tasting.releaseId) {
        await tx
          .update(bottleReleases)
          .set({
            totalTastings: sql`${bottleReleases.totalTastings} + 1`,
          })
          .where(eq(bottleReleases.id, tasting.releaseId));
      }

      const distillerIds = bottle.bottlesToDistillers.map((d) => d.distillerId);

      await Promise.all([
        tx
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
          ),
        ...tasting.tags.map((tag) =>
          tx
            .insert(bottleTags)
            .values({
              bottleId: bottle.id,
              tag,
              count: 1,
            })
            .onConflictDoUpdate({
              target: [bottleTags.bottleId, bottleTags.tag],
              set: {
                count: sql<string>`${bottleTags.count} + 1`,
              },
            }),
        ),
      ]);

      const awards = await awardAllBadgeXp(tx, {
        ...tasting,
        bottle,
      });

      for (const award of awards) {
        Object.assign(award, {
          badge: await serialize(BadgeSerializer, award.badge, context.user),
        });
      }

      return [tasting, awards];
    });

    if (!tasting) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Unable to create tasting.",
      });
    }

    if (!context.user.private) {
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

    // Update bottle rating stats
    await pushJob("UpdateBottleStats", { bottleId: bottle.id });

    return {
      tasting: await serialize(TastingSerializer, tasting, context.user),
      awards: await serialize(BadgeAwardSerializer, awards || [], context.user),
    };
  });
