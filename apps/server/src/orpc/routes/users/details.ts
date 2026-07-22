import { db } from "@peated/server/db";
import {
  changes,
  collectionBottles,
  collections,
} from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import { loadCatalogTargetReadsWithParity } from "@peated/server/lib/catalogTargetReadParity";
import { CatalogTargetResolutionError } from "@peated/server/lib/catalogTargets";
import { RESERVED_COLLECTIONS } from "@peated/server/lib/db";
import { procedure } from "@peated/server/orpc";
import { UserSchema, detailsResponse } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { scanUserTastingTargets } from "./tasting-target-scan";

const USER_STATS_BATCH_SIZE = 200;

async function aggregateTastingStats(userId: number) {
  const targetIds = new Set<number>();
  let total = 0;

  for await (const rows of scanUserTastingTargets(userId, {
    caller: "users.details",
    operation: "aggregate_tastings",
  })) {
    total += rows.length;
    for (const { identity } of rows) {
      if (identity) targetIds.add(identity.targetId);
    }
  }

  return { bottles: targetIds.size, tastings: total };
}

async function aggregateCollectionStats(userId: number) {
  const targetIds = new Set<number>();
  const libraryName = RESERVED_COLLECTIONS.library.name.toLowerCase();
  const library = { total: 0, open: 0, sealed: 0 };
  let afterId: number | null = null;

  while (true) {
    const rows = await db
      .select({
        id: collectionBottles.id,
        targetId: collectionBottles.targetId,
        bottleId: collectionBottles.bottleId,
        releaseId: collectionBottles.releaseId,
        status: collectionBottles.status,
        collectionName: collections.name,
      })
      .from(collectionBottles)
      .innerJoin(
        collections,
        eq(collections.id, collectionBottles.collectionId),
      )
      .where(
        and(
          eq(collections.createdById, userId),
          afterId === null ? undefined : gt(collectionBottles.id, afterId),
        ),
      )
      .orderBy(collectionBottles.id)
      .limit(USER_STATS_BATCH_SIZE);

    if (rows.length === 0) break;

    const { targets } = await loadCatalogTargetReadsWithParity(
      rows.map((row) => ({
        consumerTable: "collection_bottle" as const,
        rowLocator: { id: row.id },
        targetId: row.targetId,
        legacy: {
          bottleId: row.bottleId,
          releaseId: row.releaseId,
        },
      })),
      {
        actor: null,
        permissions: { canReadCatalogIdentity: true },
        caller: "users.details",
        operation: "aggregate_collections",
      },
    );

    for (const [index, row] of rows.entries()) {
      const target = targets[index];
      if (target) targetIds.add(target.targetId);

      if (row.collectionName.toLowerCase() !== libraryName) continue;
      if (row.status !== "empty") library.total += 1;
      if (row.status === "open") library.open += 1;
      if (row.status === "sealed") library.sealed += 1;
    }

    afterId = rows.at(-1)!.id;
    if (rows.length < USER_STATS_BATCH_SIZE) break;
  }

  return { collected: targetIds.size, library };
}

export default procedure
  .route({
    method: "GET",
    path: "/users/{user}",
    summary: "Get user details",
    description:
      "Retrieve user profile information including statistics for tastings, bottles, and contributions",
    operationId: "getUser",
  })
  .input(
    z.object({
      user: z.union([z.coerce.number(), z.literal("me"), z.string()]),
    }),
  )
  // TODO(response-envelope): wrap in { data } by updating detailsResponse() at cutover
  .output(
    detailsResponse(
      UserSchema.extend({
        stats: z.object({
          tastings: z.number(),
          bottles: z.number(),
          collected: z.number(),
          library: z.object({
            total: z.number(),
            open: z.number(),
            sealed: z.number(),
          }),
          contributions: z.number(),
        }),
      }),
    ),
  )
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
      if (error instanceof CatalogTargetResolutionError) {
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
