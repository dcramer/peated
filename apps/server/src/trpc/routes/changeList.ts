import { db } from "@peated/server/db";
import { changes } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { ChangeSerializer } from "@peated/server/serializers/change";
import { TRPCError } from "@trpc/server";
import type { SQL } from "drizzle-orm";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z
      .object({
        user: z.union([z.literal("me"), z.number()]).optional(),
        type: z.enum(["bottle", "entity"]).optional(),
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

    const where: (SQL<unknown> | undefined)[] = [];

    if (input.type) {
      where.push(eq(changes.objectType, input.type));
    }
    if (input.user) {
      if (input.user === "me") {
        if (!ctx.user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
          });
        }

        where.push(eq(changes.createdById, ctx.user.id));
      } else {
        where.push(eq(changes.createdById, input.user));
      }
    }

    const results = await db
      .select()
      .from(changes)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(desc(changes.createdAt));

    return {
      results: await serialize(
        ChangeSerializer,
        results.slice(0, limit),
        ctx.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
