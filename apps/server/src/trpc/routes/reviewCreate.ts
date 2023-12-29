import { db } from "@peated/server/db";
import {
  bottleAliases,
  externalSites,
  reviews,
} from "@peated/server/db/schema";
import { findBottleId } from "@peated/server/lib/bottleFinder";
import { ReviewInputSchema } from "@peated/server/schemas";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { adminProcedure } from "..";

export default adminProcedure
  .input(ReviewInputSchema)
  .mutation(async function ({ input }) {
    const site = await db.query.externalSites.findFirst({
      where: eq(externalSites.type, input.site),
    });

    if (!site) {
      throw new TRPCError({
        message: "Site not found",
        code: "NOT_FOUND",
      });
    }

    const bottleId = await findBottleId(input.name);
    await db.transaction(async (tx) => {
      // XXX: maybe we should constrain on URL?
      const [review] = await tx
        .insert(reviews)
        .values({
          bottleId,
          externalSiteId: site.id,
          name: input.name,
          issue: input.issue,
          rating: input.rating,
          url: input.url,
        })
        .onConflictDoUpdate({
          target: [reviews.externalSiteId, reviews.name, reviews.rating],
          set: {
            bottleId,
            rating: input.rating,
            url: input.url,
            issue: input.issue,
            updatedAt: sql`NOW()`,
          },
        })
        .returning();

      if (bottleId) {
        await tx
          .insert(bottleAliases)
          .values({
            bottleId,
            name: input.name,
          })
          .onConflictDoNothing();
      }
    });

    await db
      .update(externalSites)
      .set({ lastRunAt: sql`NOW()` })
      .where(eq(externalSites.id, site.id));

    return {};
  });
