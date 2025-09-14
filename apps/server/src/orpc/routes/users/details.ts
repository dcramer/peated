import { db } from "@peated/server/db";
import {
  changes,
  collectionBottles,
  collections,
  tastings,
} from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import { procedure } from "@peated/server/orpc";
import { UserSchema, detailsResponse } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

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

    const [{ totalBottles, totalTastings }] = await db
      .select({
        totalBottles: sql<string>`COUNT(DISTINCT ${tastings.bottleId})`,
        totalTastings: sql<string>`COUNT(${tastings.bottleId})`,
      })
      .from(tastings)
      .where(eq(tastings.createdById, user.id))
      .limit(1);

    const [{ collectedBottles }] = await db
      .select({
        collectedBottles: sql<string>`COUNT(DISTINCT ${collectionBottles.bottleId})`,
      })
      .from(collections)
      .innerJoin(
        collectionBottles,
        eq(collections.id, collectionBottles.collectionId),
      )
      .where(eq(collections.createdById, user.id))
      .limit(1);

    const [{ totalContributions }] = await db
      .select({
        totalContributions: sql<string>`COUNT(${changes.createdById})`,
      })
      .from(changes)
      .where(eq(changes.createdById, user.id))
      .limit(1);

    return {
      ...(await serialize(UserSerializer, user, context.user)),
      stats: {
        tastings: Number(totalTastings),
        bottles: Number(totalBottles),
        collected: Number(collectedBottles),
        contributions: Number(totalContributions),
      },
    };
  });
