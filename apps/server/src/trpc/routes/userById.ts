import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";
import { db } from "../../db";
import {
  changes,
  collectionBottles,
  collections,
  tastings,
} from "../../db/schema";
import { getUserFromId } from "../../lib/api";
import { serialize } from "../../serializers";
import { UserSerializer } from "../../serializers/user";

export default publicProcedure
  .input(z.union([z.number(), z.literal("me"), z.string()]))
  .query(async function ({ input, ctx }) {
    const user = await getUserFromId(db, input, ctx.user);

    if (!user) {
      if (input === "me") {
        throw new TRPCError({
          code: "UNAUTHORIZED",
        });
      }
      throw new TRPCError({
        code: "NOT_FOUND",
      });
    }

    const [{ totalBottles, totalTastings }] = await db
      .select({
        totalBottles: sql<string>`COUNT(DISTINCT ${tastings.bottleId})`,
        totalTastings: sql<string>`COUNT(${tastings.bottleId})`,
      })
      .from(tastings)
      .where(eq(tastings.createdById, user.id));

    const [{ collectedBottles }] = await db
      .select({
        collectedBottles: sql<string>`COUNT(DISTINCT ${collectionBottles.bottleId})`,
      })
      .from(collections)
      .innerJoin(
        collectionBottles,
        eq(collections.id, collectionBottles.collectionId),
      )
      .where(eq(collections.createdById, user.id));

    const [{ totalContributions }] = await db
      .select({
        totalContributions: sql<string>`COUNT(${changes.createdById})`,
      })
      .from(changes)
      .where(eq(changes.createdById, user.id));

    return {
      ...(await serialize(UserSerializer, user, ctx.user)),
      stats: {
        tastings: totalTastings,
        bottles: totalBottles,
        collected: collectedBottles,
        contributions: totalContributions,
      },
    };
  });
