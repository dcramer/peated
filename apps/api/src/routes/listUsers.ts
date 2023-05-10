import type { RouteOptions } from "fastify";
import { db } from "../lib/db";
import { IncomingMessage, Server, ServerResponse } from "http";
import { validateRequest } from "../middleware/auth";
import { serializeUser } from "../lib/auth";
import { users } from "../db/schema";
import { SQL, and, asc, eq, ilike, or } from "drizzle-orm";

export default {
  method: "GET",
  url: "/users",
  schema: {
    querystring: {
      type: "object",
      properties: {
        query: { type: "string" },
        page: { type: "number" },
      },
    },
  },
  preHandler: [validateRequest],
  handler: async (req, res) => {
    const page = req.query.page || 1;
    const query = req.query.query || "";

    const limit = 100;
    const offset = (page - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [];
    if (query) {
      where.push(or(ilike(users.displayName, query), eq(users.email, query)));
    }

    const results = await db
      .select()
      .from(users)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(users.displayName));

    res.send(results.map((u) => serializeUser(u, req.user)));
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Querystring: {
      query?: string;
      page?: number;
    };
  }
>;
