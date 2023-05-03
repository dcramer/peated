import type { RouteOptions } from "fastify";
import { prisma } from "../lib/db";
import { IncomingMessage, Server, ServerResponse } from "http";
import { Distiller, Prisma } from "@prisma/client";
import { validateRequest } from "../middleware/auth";

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
        containers: query,
        mode: "insensitive",
      };
    }
    where.OR = [{ public: true }];
    if (req.user) {
      where.OR.push({ createdById: req.user.id });
    }

    const results = await prisma.distiller.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: {
        bottles: {
          _count: "desc",
        },
      },
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

export const addDistiller: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Body: Distiller;
  }
> = {
  method: "POST",
  url: "/distillers",
  schema: {
    body: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
        country: { type: "string" },
        region: { type: "string" },
      },
    },
  },
  preHandler: [validateRequest],
  handler: async (req, res) => {
    const body = req.body;
    // gross syntax, whats better?
    const data: Prisma.DistillerUncheckedCreateInput = (({ ...d }: any) => d)(
      body
    );

    data.createdById = req.user.id;
    data.public = req.user.admin;

    const distiller = await prisma.distiller.upsert({
      where: {
        name: data.name,
      },
      update: {},
      create: data,
    });
    res.status(201).send(distiller);
  },
};
