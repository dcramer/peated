import { EMPTY_TASTING_BAND_COUNTS } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { implement } from "@peated/server/orpc";
import userTastingStatsContract from "@peated/server/orpc/contracts/users/tasting-stats";
import { eq } from "drizzle-orm";
import { buildAgeStats } from "./age-stats";
import {
  scanUserTastingBottles,
  UserBottleReadIntegrityError,
} from "./tasting-bottle-scan";

export default implement(userTastingStatsContract).handler(async function ({
  input,
  context,
  errors,
}) {
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
  const bands = { total: 0, ...EMPTY_TASTING_BAND_COUNTS };
  let total = 0;
  let unstatedCount = 0;

  try {
    for await (const rows of scanUserTastingBottles(user.id)) {
      total += rows.length;
      for (const { bottle, ratingBand } of rows) {
        if (ratingBand !== null) {
          bands[ratingBand] += 1;
          bands.total += 1;
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
    bands,
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
