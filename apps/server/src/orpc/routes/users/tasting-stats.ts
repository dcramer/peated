import { SIMPLE_RATING_VALUES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { procedure } from "@peated/server/orpc";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { AgeStatsSchema, buildAgeStats } from "./age-stats";
import {
  scanUserTastingBottles,
  UserBottleReadIntegrityError,
} from "./tasting-bottle-scan";

const TastingStatsSchema = z.object({
  total: z.number(),
  uniqueBottles: z.number(),
  ratings: z.object({
    total: z.number(),
    pass: z.number(),
    sip: z.number(),
    savor: z.number(),
  }),
  mostTastedBottle: z
    .object({
      id: z.number(),
      name: z.string(),
      count: z.number(),
    })
    .nullable(),
  age: AgeStatsSchema,
});

export default procedure
  .route({
    method: "GET",
    path: "/users/{user}/tasting-stats",
    summary: "Get user tasting statistics",
    description:
      "Retrieve rating, exploration, and age insights for bottles tasted by a visible user",
    operationId: "getUserTastingStats",
  })
  .input(
    z.object({
      user: z.union([z.literal("me"), z.string(), z.coerce.number()]),
    }),
  )
  .output(TastingStatsSchema)
  .handler(async function ({ input, context, errors }) {
    const user = await getUserFromId(db, input.user, context.user);
    if (!user) {
      throw errors.NOT_FOUND({
        message: "User not found.",
      });
    }

    if (!(await profileVisible(db, user, context.user))) {
      throw errors.BAD_REQUEST({
        message: "User's profile is private.",
      });
    }

    const ages: number[] = [];
    const bottleCounts = new Map<number, number>();
    const ratings = { total: 0, pass: 0, sip: 0, savor: 0 };
    let total = 0;
    let unstatedCount = 0;

    try {
      for await (const rows of scanUserTastingBottles(user.id)) {
        total += rows.length;
        for (const { bottle, rating } of rows) {
          if (rating === SIMPLE_RATING_VALUES.PASS) {
            ratings.pass += 1;
            ratings.total += 1;
          } else if (rating === SIMPLE_RATING_VALUES.SIP) {
            ratings.sip += 1;
            ratings.total += 1;
          } else if (rating === SIMPLE_RATING_VALUES.SAVOR) {
            ratings.savor += 1;
            ratings.total += 1;
          }

          if (bottle) {
            bottleCounts.set(bottle.id, (bottleCounts.get(bottle.id) ?? 0) + 1);
          }
          if (bottle?.statedAge === null || !bottle) {
            unstatedCount += 1;
          } else {
            ages.push(bottle.statedAge);
          }
        }
      }
    } catch (error) {
      if (error instanceof UserBottleReadIntegrityError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }

    const [mostTastedBottleId, mostTastedCount] = Array.from(bottleCounts)
      .filter(([, count]) => count > 1)
      .sort(
        ([leftId, leftCount], [rightId, rightCount]) =>
          rightCount - leftCount || leftId - rightId,
      )[0] ?? [null, 0];
    const mostTastedBottle =
      mostTastedBottleId === null
        ? null
        : await db.query.bottles.findFirst({
            where: eq(bottles.id, mostTastedBottleId),
            columns: { id: true, fullName: true },
          });

    return {
      total,
      uniqueBottles: bottleCounts.size,
      ratings,
      mostTastedBottle: mostTastedBottle
        ? {
            id: mostTastedBottle.id,
            name: mostTastedBottle.fullName,
            count: mostTastedCount,
          }
        : null,
      age: buildAgeStats(ages, unstatedCount),
    };
  });
