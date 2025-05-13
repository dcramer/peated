import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { comments } from "@peated/server/db/schema";
import { CursorSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { CommentSerializer } from "@peated/server/serializers/comment";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";

export default procedure
  .route({ method: "GET", path: "/comments" })
  .input(
    z.object({
      user: z.union([z.literal("me"), z.coerce.number()]).optional(),
      tasting: z.coerce.number().optional(),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(100),
    }),
  )
  .output(
    z.object({
      results: z.array(z.any()),
      rel: CursorSchema,
    }),
  )
  .handler(async function ({ input, context }) {
    const { cursor, limit, ...rest } = input;
    const offset = (cursor - 1) * limit;

    // have to specify at least one so folks dont scrape all comments
    if (!context.user?.admin && !rest.tasting && !rest.user) {
      return {
        results: [],
        rel: {
          nextCursor: null,
          prevCursor: null,
        },
      };
    }

    const where = [];

    if (rest.user) {
      if (rest.user === "me") {
        if (!context.user) {
          throw new ORPCError("UNAUTHORIZED");
        }
        where.push(eq(comments.createdById, context.user.id));
      } else {
        where.push(eq(comments.createdById, rest.user));
      }
    }

    if (rest.tasting) {
      where.push(eq(comments.tastingId, rest.tasting));
    }

    const results = await db
      .select()
      .from(comments)
      .where(and(...where))
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(comments.createdAt));

    return {
      results: await serialize(
        CommentSerializer,
        results.slice(0, limit),
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
