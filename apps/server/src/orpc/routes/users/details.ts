import { implement } from "@orpc/server";
import sentryMiddleware from "@peated/orpc/server/middleware";
import { db } from "@peated/server/db";
import {
  bottles,
  bottleTombstones,
  changes,
  collectionBottles,
  collections,
} from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import { RESERVED_COLLECTIONS } from "@peated/server/lib/db";
import type { Context } from "@peated/server/orpc/context";
import userDetailsContract from "@peated/server/orpc/contracts/users/details";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { and, eq, gt, sql } from "drizzle-orm";
import {
  readJoinedUserBottle,
  scanUserTastingBottles,
  UserBottleReadIntegrityError,
} from "./tasting-bottle-scan";

const USER_STATS_BATCH_SIZE = 200;

async function aggregateTastingStats(userId: number) {
  const bottleIds = new Set<number>();
  let total = 0;

  for await (const rows of scanUserTastingBottles(userId)) {
    total += rows.length;
    for (const { bottle } of rows) {
      if (bottle) bottleIds.add(bottle.id);
    }
  }

  return { bottles: bottleIds.size, tastings: total };
}

async function aggregateCollectionStats(userId: number) {
  const bottleIds = new Set<number>();
  const libraryName = RESERVED_COLLECTIONS.library.name.toLowerCase();
  const library = { total: 0, open: 0, sealed: 0 };
  let afterId: number | null = null;

  while (true) {
    const rows = await db
      .select({
        id: collectionBottles.id,
        storedBottleId: collectionBottles.bottleId,
        bottle: {
          id: bottles.id,
          groupId: bottles.groupId,
          brandId: bottles.brandId,
          category: bottles.category,
          flavorProfile: bottles.flavorProfile,
          statedAge: bottles.statedAge,
        },
        retiredBottleId: bottleTombstones.bottleId,
        status: collectionBottles.status,
        collectionName: collections.name,
      })
      .from(collectionBottles)
      .innerJoin(
        collections,
        eq(collections.id, collectionBottles.collectionId),
      )
      .leftJoin(bottles, eq(bottles.id, collectionBottles.bottleId))
      .leftJoin(bottleTombstones, eq(bottleTombstones.bottleId, bottles.id))
      .where(
        and(
          eq(collections.createdById, userId),
          afterId === null ? undefined : gt(collectionBottles.id, afterId),
        ),
      )
      .orderBy(collectionBottles.id)
      .limit(USER_STATS_BATCH_SIZE);

    if (rows.length === 0) break;

    for (const row of rows) {
      const bottle = readJoinedUserBottle(row);
      if (bottle) bottleIds.add(bottle.id);

      if (row.collectionName.toLowerCase() !== libraryName) continue;
      if (row.status !== "empty") library.total += 1;
      if (row.status === "open") library.open += 1;
      if (row.status === "sealed") library.sealed += 1;
    }

    afterId = rows.at(-1)!.id;
    if (rows.length < USER_STATS_BATCH_SIZE) break;
  }

  return { collected: bottleIds.size, library };
}

export default implement(userDetailsContract)
  .$context<Context>()
  .use(sentryMiddleware())
  .handler(async function ({ input, context, errors }) {
    const user = await getUserFromId(db, input.user, context.user);

    if (!user) {
      if (input.user === "me") {
        throw errors.UNAUTHORIZED();
      }
      throw errors.NOT_FOUND({
        message: "User not found",
      });
    }

    let tastingStats: Awaited<ReturnType<typeof aggregateTastingStats>>;
    let collectionStats: Awaited<ReturnType<typeof aggregateCollectionStats>>;
    try {
      tastingStats = await aggregateTastingStats(user.id);
      collectionStats = await aggregateCollectionStats(user.id);
    } catch (error) {
      if (error instanceof UserBottleReadIntegrityError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }

    const userActor = await db.query.actors.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.type, "user"), eq(table.key, String(user.id))),
    });

    const [{ totalContributions }] = userActor
      ? await db
          .select({
            totalContributions: sql<string>`COUNT(${changes.actorId})`,
          })
          .from(changes)
          .where(eq(changes.actorId, userActor.id))
          .limit(1)
      : [{ totalContributions: "0" }];

    return {
      ...(await serialize(UserSerializer, user, context.user)),
      stats: {
        tastings: tastingStats.tastings,
        bottles: tastingStats.bottles,
        collected: collectionStats.collected,
        library: collectionStats.library,
        contributions: Number(totalContributions),
      },
    };
  });
