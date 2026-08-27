import { db } from "@peated/server/db";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { implement } from "@peated/server/orpc";
import userFlavorListContract from "@peated/server/orpc/contracts/users/flavor-list";
import {
  scanUserTastingBottles,
  UserBottleReadIntegrityError,
} from "./tasting-bottle-scan";

export default implement(userFlavorListContract).handler(async function ({
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
      message: "User's profile is not public.",
    });
  }

  const byFlavor = new Map<
    string,
    { count: number; score: number; hasRating: boolean }
  >();
  let totalCount = 0;
  let totalScore = 0;

  try {
    for await (const rows of scanUserTastingBottles(user.id)) {
      for (const { bottle, rating } of rows) {
        totalCount += 1;
        totalScore += rating ?? 0;

        if (!bottle?.flavorProfile) continue;

        const current = byFlavor.get(bottle.flavorProfile) ?? {
          count: 0,
          score: 0,
          hasRating: false,
        };
        current.count += 1;
        current.score += rating ?? 0;
        current.hasRating ||= rating !== null;
        byFlavor.set(bottle.flavorProfile, current);
      }
    }
  } catch (error) {
    if (error instanceof UserBottleReadIntegrityError) {
      throw errors.CONFLICT({ message: error.message, cause: error });
    }
    throw error;
  }

  const results = Array.from(byFlavor, ([flavorProfile, stats]) => ({
    flavorProfile,
    count: stats.count,
    score: stats.score,
    hasRating: stats.hasRating,
  }))
    .sort(
      (left, right) =>
        Number(left.hasRating) - Number(right.hasRating) ||
        right.score - left.score ||
        right.count - left.count ||
        left.flavorProfile.localeCompare(right.flavorProfile),
    )
    .slice(0, 25)
    .map(({ hasRating: _, ...result }) => result);

  return {
    results,
    totalScore,
    totalCount,
  };
});
