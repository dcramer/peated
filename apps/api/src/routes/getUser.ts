import { UserSchema } from "@peated/shared/schemas";
import { eq, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { db } from "../db";
import {
  changes,
  collectionBottles,
  collections,
  tastings,
} from "../db/schema";
import { getUserFromId } from "../lib/api";
import { serialize } from "../lib/serializers";
import { UserSerializer } from "../lib/serializers/user";

export default {
  method: "GET",
  url: "/users/:userId",
  schema: {
    params: {
      type: "object",
      required: ["userId"],
      properties: {
        userId: {
          anyOf: [{ type: "number" }, { type: "string" }, { const: "me" }],
        },
      },
    },
    response: {
      200: zodToJsonSchema(
        UserSchema.extend({
          stats: z.object({
            tastings: z.number(),
            bottles: z.number(),
            contributions: z.number(),
            collected: z.number(),
          }),
        }),
      ),
    },
  },
  handler: async (req, res) => {
    const user = await getUserFromId(db, req.params.userId, req.user);
    if (!user) {
      if (req.params.userId === "me") {
        return res.status(401).send({ error: "Unauthorized " });
      }
      return res.status(404).send({ error: "Not found" });
    }

    const [{ totalBottles, totalTastings }] = await db
      .select({
        totalBottles: sql`COUNT(DISTINCT ${tastings.bottleId})`,
        totalTastings: sql`COUNT(${tastings.bottleId})`,
      })
      .from(tastings)
      .where(eq(tastings.createdById, user.id));

    const [{ collectedBottles }] = await db
      .select({
        collectedBottles: sql`COUNT(DISTINCT ${collectionBottles.bottleId})`,
      })
      .from(collections)
      .innerJoin(
        collectionBottles,
        eq(collections.id, collectionBottles.collectionId),
      )
      .where(eq(collections.createdById, user.id));

    const [{ totalContributions }] = await db
      .select({
        totalContributions: sql`COUNT(${changes.createdById})`,
      })
      .from(changes)
      .where(eq(changes.createdById, user.id));

    res.send({
      ...(await serialize(UserSerializer, user, req.user)),
      stats: {
        tastings: totalTastings,
        bottles: totalBottles,
        collected: collectedBottles,
        contributions: totalContributions,
      },
    });
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      userId: string | number | "me";
    };
  }
>;
