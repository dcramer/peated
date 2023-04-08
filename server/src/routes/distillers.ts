import type { RouteOptions } from "fastify";
import { prisma } from "../lib/db";
import { IncomingMessage, Server, ServerResponse } from "http";

export const listDistillers: RouteOptions<
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
  url: "/distillers",
  schema: {
    querystring: {
      type: "object",
      properties: {
        query: { type: "string" },
        page: { type: "number" },
      },
    },
  },
  handler: async (req, res) => {
    const page = req.query.page || 1;
    const query = req.query.query || "";

    const limit = 100;
    const offset = (page - 1) * limit;

    const where: { [key: string]: any } = {};
    if (query) {
      where.name = {
        search: query.split(" ").join(" & "),
        mode: "insensitive",
      };
    }

    const results = await prisma.distiller.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { name: "asc" },
    });
    res.send(results);
  },
};

export const getDistiller: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      distillerId: number;
    };
  }
> = {
  method: "GET",
  url: "/distillers/:distillerId",
  schema: {
    params: {
      type: "object",
      required: ["distillerId"],
      properties: {
        distillerId: { type: "number" },
      },
    },
  },
  handler: async (req, res) => {
    const checkin = await prisma.distiller.findUnique({
      where: {
        id: req.params.distillerId,
      },
    });
    if (!checkin) {
      res.status(404).send({ error: "Not found" });
    } else {
      res.send(checkin);
    }
  },
};
