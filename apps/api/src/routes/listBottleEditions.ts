import { EditionSchema } from "@peated/shared/schemas";
import { asc, eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { db } from "../db";
import { bottles, editions } from "../db/schema";
import { buildPageLink } from "../lib/paging";
import { serialize } from "../lib/serializers";
import { EditionSerializer } from "../lib/serializers/edition";

export default {
  method: "GET",
  url: "/bottles/:bottleId/editions",
  schema: {
    params: {
      type: "object",
      required: ["bottleId"],
      properties: {
        bottleId: { type: "number" },
      },
    },
    response: {
      200: zodToJsonSchema(
        z.object({
          results: z.array(EditionSchema),
        }),
      ),
    },
  },
  handler: async (req, res) => {
    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, req.params.bottleId));

    if (!bottle) {
      return res.status(404).send({ error: "Not found" });
    }

    const page = req.query.page || 1;
    const limit = 100;
    const offset = (page - 1) * limit;

    const results = await db
      .select()
      .from(editions)
      .where(eq(editions.bottleId, bottle.id))
      .limit(limit + 1)
      .offset(offset)
      .orderBy(
        asc(editions.name),
        asc(editions.vintageYear),
        asc(editions.barrel),
      );

    res.send({
      results: await serialize(
        EditionSerializer,
        results.slice(0, limit),
        req.user,
      ),
      rel: {
        nextPage: results.length > limit ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
        next:
          results.length > limit
            ? buildPageLink(req.routeOptions.url, req.query, page + 1)
            : null,
        prev:
          page > 1
            ? buildPageLink(req.routeOptions.url, req.query, page - 1)
            : null,
      },
    });
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      bottleId: number;
    };
    Querystring: {
      page?: number;
    };
  }
>;
