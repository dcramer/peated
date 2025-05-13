import { db } from "@peated/server/db";
import { comments } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { CommentSerializer } from "@peated/server/serializers/comment";
import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z
      .object({
        user: z.union([z.literal("me"), z.number()]).optional(),
        tasting: z.number().optional(),
        cursor: z.number().gte(1).default(1),
        limit: z.number().gte(1).lte(100).default(100),
      })
      .default({
        cursor: 1,
        limit: 100,
      }),
  )
  .query(async function ({ input: { cursor, limit, ...input }, ctx }) {
    const offset = (cursor - 1) * limit;

    // have to specify at least one so folks dont scrape all comments
    if (!ctx.user?.admin && !input.tasting && !input.user) {
      return {
        results: [],
        rel: {
          nextCursor: null,
          prevCursor: null,
        },
      };
    }

    const where = [];

    if (input.user) {
      if (input.user === "me") {
        if (!ctx.user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
          });
        }
        where.push(eq(comments.createdById, ctx.user.id));
      } else {
        where.push(eq(comments.createdById, input.user));
      }
    }

    if (input.tasting) {
      where.push(eq(comments.tastingId, input.tasting));
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
        ctx.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
