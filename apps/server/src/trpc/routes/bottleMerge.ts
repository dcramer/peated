import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleTags,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  collectionBottles,
  flightBottles,
  reviews,
  storePrices,
  tastings,
  type Bottle,
} from "@peated/server/db/schema";
import { pushJob } from "@peated/server/jobs";
import { logError } from "@peated/server/lib/log";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { TRPCError } from "@trpc/server";
import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { modProcedure } from "..";

// TODO: this should happen async
async function mergeBottlesInto(
  toBottle: Bottle,
  ...fromBottles: Bottle[]
): Promise<Bottle> {
  const fromBottleIds = fromBottles.map((e) => e.id);
  console.log(
    `Merging bottles ${fromBottleIds.join(", ")} into ${toBottle.id}.`,
  );

  // TODO: this doesnt handle duplicate bottles
  return await db.transaction(async (tx) => {
    await tx
      .update(tastings)
      .set({
        bottleId: toBottle.id,
      })
      .where(inArray(tastings.bottleId, fromBottleIds));

    await tx
      .update(storePrices)
      .set({
        bottleId: toBottle.id,
      })
      .where(inArray(storePrices.bottleId, fromBottleIds));

    await tx
      .update(reviews)
      .set({
        bottleId: toBottle.id,
      })
      .where(inArray(reviews.bottleId, fromBottleIds));

    await tx
      .update(flightBottles)
      .set({
        bottleId: toBottle.id,
      })
      .where(inArray(flightBottles.bottleId, fromBottleIds));

    await tx
      .update(collectionBottles)
      .set({
        bottleId: toBottle.id,
      })
      .where(inArray(collectionBottles.bottleId, fromBottleIds));

    // TODO: handle conflicts
    await tx
      .update(bottleAliases)
      .set({
        bottleId: toBottle.id,
      })
      .where(inArray(bottleAliases.bottleId, fromBottleIds));

    for (const id of fromBottleIds) {
      await tx.insert(bottleTombstones).values({
        bottleId: id,
        newBottleId: toBottle.id,
      });
    }

    const existingTags = await tx.query.bottleTags.findMany({
      where: inArray(bottleTags.bottleId, fromBottleIds),
    });
    for (const row of existingTags) {
      await tx
        .insert(bottleTags)
        .values({
          bottleId: toBottle.id,
          tag: row.tag,
          count: row.count,
        })
        .onConflictDoUpdate({
          target: [bottleTags.bottleId, bottleTags.tag],
          set: {
            count: sql<number>`${bottleTags.count} + 1`,
          },
        });
    }

    // update materialized stats
    const [bottle] = await tx
      .update(bottles)
      .set({
        totalTastings: sql`(SELECT COUNT(*) FROM ${tastings} WHERE ${bottles.id} = ${tastings.bottleId})`,
        avgRating: sql`(SELECT AVG(${tastings.rating}) FROM ${tastings} WHERE ${bottles.id} = ${tastings.bottleId})`,
      })
      .where(eq(bottles.id, toBottle.id))
      .returning();

    // wipe old bottles
    await tx
      .delete(bottleTags)
      .where(inArray(bottleTags.bottleId, fromBottleIds));
    await tx
      .delete(bottlesToDistillers)
      .where(inArray(bottlesToDistillers.bottleId, fromBottleIds));
    await tx.delete(bottles).where(inArray(bottles.id, fromBottleIds));

    return bottle;
  });
}

export default modProcedure
  .input(
    z.object({
      root: z.number(),
      other: z.number(),
      direction: z.enum(["mergeInto", "mergeFrom"]).default("mergeInto"),
    }),
  )
  .mutation(async function ({ input, ctx }) {
    if (input.root === input.other) {
      throw new TRPCError({
        message: "Cannot merge a bottle into itself.",
        code: "BAD_REQUEST",
      });
    }

    const [rootBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.root));

    if (!rootBottle) {
      throw new TRPCError({
        message: "root not found.",
        code: "NOT_FOUND",
      });
    }

    const [otherBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.other));

    if (!otherBottle) {
      throw new TRPCError({
        message: "other not found.",
        code: "NOT_FOUND",
      });
    }

    // if mergeInto, rootEntity merges into otherEntity
    const fromBottle =
      input.direction === "mergeInto" ? rootBottle : otherBottle;
    const toBottle = input.direction === "mergeInto" ? otherBottle : rootBottle;

    const newBottle = await mergeBottlesInto(toBottle, fromBottle);
    try {
      await pushJob("GenerateBottleDetails", { bottleId: toBottle.id });
    } catch (err) {
      logError(err, {
        entity: {
          id: toBottle.id,
        },
      });
    }

    return await serialize(BottleSerializer, newBottle, ctx.user);
  });
