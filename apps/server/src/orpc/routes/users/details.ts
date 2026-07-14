import { db } from "@peated/server/db";
import {
  changes,
  collectionBottles,
  collections,
  tastings,
} from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import { RESERVED_COLLECTIONS } from "@peated/server/lib/db";
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

    const [{ totalBottles, totalTastings }] = await db
      .select({
        totalBottles: sql<string>`COUNT(DISTINCT ${tastings.bottleId})`,
        totalTastings: sql<string>`COUNT(${tastings.bottleId})`,
      })
      .from(tastings)
      .where(eq(tastings.createdById, user.id))
      .limit(1);

    const [
      {
        collectedBottles,
        totalLibraryBottles,
        openLibraryBottles,
        sealedLibraryBottles,
      },
    ] = await db
      .select({
        collectedBottles: sql<string>`COUNT(DISTINCT ${collectionBottles.bottleId})`,
        totalLibraryBottles: sql<string>`COUNT(${collectionBottles.id}) FILTER (WHERE LOWER(${collections.name}) = ${RESERVED_COLLECTIONS.library.name.toLowerCase()} AND ${collectionBottles.status} IS DISTINCT FROM 'empty')`,
        openLibraryBottles: sql<string>`COUNT(${collectionBottles.id}) FILTER (WHERE LOWER(${collections.name}) = ${RESERVED_COLLECTIONS.library.name.toLowerCase()} AND ${collectionBottles.status} = 'open')`,
        sealedLibraryBottles: sql<string>`COUNT(${collectionBottles.id}) FILTER (WHERE LOWER(${collections.name}) = ${RESERVED_COLLECTIONS.library.name.toLowerCase()} AND ${collectionBottles.status} = 'sealed')`,
      })
      .from(collections)
      .innerJoin(
        collectionBottles,
        eq(collections.id, collectionBottles.collectionId),
      )
      .where(eq(collections.createdById, user.id))
      .limit(1);

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
        tastings: Number(totalTastings),
        bottles: Number(totalBottles),
        collected: Number(collectedBottles),
        library: {
          total: Number(totalLibraryBottles),
          open: Number(openLibraryBottles),
          sealed: Number(sealedLibraryBottles),
        },
        contributions: Number(totalContributions),
      },
    };
  });
