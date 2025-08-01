import { db } from "@peated/server/db";
import { bottles, tastings } from "@peated/server/db/schema";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { procedure } from "@peated/server/orpc";
import { sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/users/{user}/flavors",
    operationId: "listUserFlavorProfiles",
    summary: "List user flavor profiles",
    description:
      "Retrieve flavor profiles from bottles tasted by a user with counts and scores. Respects privacy settings",
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

    const results = await db.execute<{
      flavor: string;
      count: string;
      score: string;
    }>(
      sql<{
        flavor: string;
        count: string;
      }>`SELECT flavor, COUNT(flavor) as count, SUM(rating) as score
    FROM (
      SELECT ${bottles.flavorProfile} as flavor, ${tastings.rating} as rating
      FROM ${bottles}
      JOIN ${tastings} ON ${bottles.id} = ${tastings.bottleId}
      WHERE ${tastings.createdById} = ${user.id}
      AND ${bottles.flavorProfile} IS NOT NULL
    ) as t
    GROUP BY flavor
    ORDER BY score DESC, count DESC
    LIMIT 25`,
    );

    const { count: totalCount, score: totalScore } = (
      await db.execute<{ count: string; score: string }>(
        sql<{
          count: number;
          score: number;
        }>`SELECT COUNT(*) as count, SUM(${tastings.rating}) as score
        FROM ${tastings}
        WHERE ${tastings.createdById} = ${user.id}
      `,
      )
    ).rows[0];

    return {
      results: results.rows.map(({ flavor, count, score }) => ({
        flavorProfile: flavor,
        count: Number(count),
        score: Number(score),
      })),
      totalScore: Number(totalScore),
      totalCount: Number(totalCount),
    };
  });
