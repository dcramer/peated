import { db } from "@peated/server/db";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { procedure } from "@peated/server/orpc";
import { z } from "zod";
import { AgeStatsSchema, buildAgeStats } from "./age-stats";
import {
  scanUserTastingBottles,
  UserBottleReadIntegrityError,
} from "./tasting-bottle-scan";

const TastingStatsSchema = z.object({
  total: z.number(),
  age: AgeStatsSchema,
});

export default procedure
  .route({
    method: "GET",
    path: "/users/{user}/tasting-stats",
    summary: "Get user tasting statistics",
    description: "Retrieve age insights for bottles tasted by a visible user",
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
    let total = 0;
    let unstatedCount = 0;

    try {
      for await (const rows of scanUserTastingBottles(user.id)) {
        total += rows.length;
        for (const { bottle } of rows) {
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

    return {
      total,
      age: buildAgeStats(ages, unstatedCount),
    };
  });
