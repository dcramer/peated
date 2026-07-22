import { db } from "@peated/server/db";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { CatalogTargetResolutionError } from "@peated/server/lib/catalogTargets";
import { procedure } from "@peated/server/orpc";
import { z } from "zod";
import { scanUserTastingTargets } from "./tasting-target-scan";

export default procedure
  .route({
    method: "GET",
    path: "/users/{user}/flavors",
    summary: "List user flavor profiles",
    description:
      "Retrieve flavor profiles from bottles tasted by a user with counts and scores. Respects privacy settings",
    operationId: "listUserFlavors",
  })
  .input(
    z.object({
      user: z.union([z.literal("me"), z.string(), z.coerce.number()]),
    }),
  )
  .output(
    z.object({
      results: z.array(
        z.object({
          flavorProfile: z.string(),
          count: z.number(),
          score: z.number(),
        }),
      ),
      totalScore: z.number(),
      totalCount: z.number(),
    }),
  )
  .handler(async function ({ input, context, errors }) {
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
      for await (const rows of scanUserTastingTargets(user.id, {
        caller: "users.flavor-list",
        operation: "aggregate_flavors",
      })) {
        for (const { identity, rating } of rows) {
          totalCount += 1;
          totalScore += rating ?? 0;

          const source =
            identity?.kind === "bottle"
              ? identity.bottle
              : identity?.kind === "group"
                ? identity.group
                : null;
          if (!source?.flavorProfile) continue;

          const current = byFlavor.get(source.flavorProfile) ?? {
            count: 0,
            score: 0,
            hasRating: false,
          };
          current.count += 1;
          current.score += rating ?? 0;
          current.hasRating ||= rating !== null;
          byFlavor.set(source.flavorProfile, current);
        }
      }
    } catch (error) {
      if (error instanceof CatalogTargetResolutionError) {
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
