import type { RouteOptions } from "fastify";
import { prisma } from "../lib/db";
import { Prisma, User } from "@prisma/client";
import { IncomingMessage, Server, ServerResponse } from "http";
import { validateRequest } from "../middleware/auth";

const serializeUser = (user: User, currentUser: User) => {
  const data: { [key: string]: any } = {
    id: user.id,
    displayName: user.displayName,
    imageUrl: user.imageUrl,
  };
  if (currentUser.admin || currentUser.id === user.id) {
    data.email = user.email;
    data.createdAt = user.email;
  }
  return data;
};

export const listUsers: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Querystring: {
      query?: string;
      page?: number;
    };
  }
> = {
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

    const where: Prisma.UserWhereInput = {};
    if (query) {
      where.OR = [
        {
          displayName: {
            search: query.split(" ").join(" & "),
            mode: "insensitive",
          },
        },
        {
          email: query,
        },
      ];
    }

    const results = await prisma.user.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { displayName: "asc" },
    });
    res.send(results.map((u) => serializeUser(u, req.user)));
  },
};

export const getUser: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      userId: number;
    };
  }
> = {
  method: "GET",
  url: "/users/:userId",
  schema: {
    params: {
      type: "object",
      required: ["userId"],
      properties: {
        userId: { type: "number" },
      },
    },
  },
  preHandler: [validateRequest],
  handler: async (req, res) => {
    const user = await prisma.user.findUnique({
      where: {
        id: req.params.userId,
      },
    });
    if (!user) {
      res.status(404).send({ error: "Not found" });
    } else {
      res.send(serializeUser(user, req.user));
    }
  },
};
