import { db } from "@peated/server/db";
import { bottleEditions, bottles } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { BottleEditionSerializer } from "@peated/server/serializers/bottleEdition";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z.object({
      bottle: z.number(),
      cursor: z.number().gte(1).default(1),
      limit: z.number().gte(1).lte(100).default(25),
    }),
  )
  .query(async function ({ input: { cursor, limit, ...input }, ctx }) {
    const offset = (cursor - 1) * limit;

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.bottle));

    if (!bottle) {
      throw new TRPCError({
        message: "Bottle not found.",
        code: "NOT_FOUND",
      });
    }

    const results = await db
      .select()
      .from(bottleEditions)
      .where(eq(bottleEditions.bottleId, bottle.id))
      .orderBy(bottleEditions.name)
      .limit(limit + 1)
      .offset(offset);

    return {
      results: await serialize(
        BottleEditionSerializer,
        results.slice(0, limit),
        ctx.user ?? undefined,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
