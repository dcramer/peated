import { db } from "@peated/server/db";
import { tastings } from "@peated/server/db/schema";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { procedure } from "@peated/server/orpc";
import { sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/users/{user}/tags",
    summary: "List user tags",
    spec: {
      operationId: "listUserTags",
    },
    description:
      "Retrieve tags used by a user in their tastings with usage counts. Respects privacy settings",
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
          tag: z.string(),
          count: z.number(),
        }),
      ),
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

    const results = await db.execute<{ tag: string; count: string }>(
      sql<{ tag: string; count: string }>`SELECT tag, COUNT(tag) as count
    FROM (
      SELECT unnest(${tastings.tags}) as tag
      FROM ${tastings}
      WHERE ${tastings.createdById} = ${user.id}
    ) as t
    GROUP BY tag
    ORDER BY count DESC
    LIMIT 25`,
    );

    const totalCount = Number(
      (
        await db.execute<{ count: string }>(
          sql<{ count: number }>`SELECT COUNT(*) as count
        FROM ${tastings}
        WHERE ${tastings.createdById} = ${user.id}
        AND array_length(${tastings.tags}, 1) > 0
      `,
        )
      ).rows[0]!.count,
    );

    return {
      results: results.rows.map(({ tag, count }) => ({
        tag,
        count: Number(count),
      })),
      totalCount,
    };
  });
