import type { RouteOptions } from "fastify";
import { prisma } from "../lib/db";
import { IncomingMessage, Server, ServerResponse } from "http";

export const listCheckins: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Querystring: {
      page?: number;
    };
  }
> = {
  method: "GET",
  url: "/checkins",
  schema: {
    querystring: {
      type: "object",
      properties: {
        page: { type: "number" },
      },
    },
  },
  handler: async (req, res) => {
    const page = req.query.page || 1;

    const limit = 100;
    const offset = (page - 1) * limit;

    const results = await prisma.checkin.findMany({
      include: {
        bottle: true,
      },
      skip: offset,
      take: limit,
      orderBy: { createdAt: "desc" },
    });
    res.send(results);
  },
};

export const getCheckin: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      checkinId: number;
    };
  }
> = {
  method: "GET",
  url: "/checkins/:checkinId",
  schema: {
    params: {
      type: "object",
      required: ["checkinId"],
      properties: {
        checkinId: { type: "number" },
      },
    },
  },
  handler: async (req, res) => {
    const checkin = await prisma.checkin.findUnique({
      include: {
        bottle: true,
      },
      where: {
        id: req.params.checkinId,
      },
    });
    if (!checkin) {
      res.status(404).send({ error: "Not found" });
    } else {
      res.send(checkin);
    }
  },
};
