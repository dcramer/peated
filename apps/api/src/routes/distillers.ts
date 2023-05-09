import type { RouteOptions } from "fastify";
import { prisma } from "../lib/db";
import { IncomingMessage, Server, ServerResponse } from "http";
import { Distiller, Prisma } from "@prisma/client";
import { validateRequest } from "../middleware/auth";
import { buildPageLink } from "../lib/paging";

export const listDistillers: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Querystring: {
      query?: string;
      page?: number;
      sort?: "name";
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
        sort: { type: "string" },
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
        contains: query,
        mode: "insensitive",
      };
    }
    where.OR = [{ public: true }];
    if (req.user) {
      where.OR.push({ createdById: req.user.id });
    }

    let orderBy: any;
    switch (req.query.sort) {
      case "name":
        orderBy = {
          name: "asc",
        };
        break;
      default:
        // TODO(dcramer): we want to sort by checkins

        orderBy = {
          bottles: {
            _count: "desc",
          },
        };
    }

    const results = await prisma.distiller.findMany({
      where,
      skip: offset,
      take: limit + 1,
      orderBy,
    });

    res.send({
      results: results.slice(0, limit),
      rel: {
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
    const distiller = await prisma.distiller.findUnique({
      where: {
        id: req.params.distillerId,
      },
    });
    if (!distiller) {
      return res.status(404).send({ error: "Not found" });
    }

    const totalBottles = await prisma.bottle.count({
      where: { distillers: { some: { id: distiller.id } } },
    });

    res.send({
      ...distiller,
      stats: {
        bottles: totalBottles,
      },
    });
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

    const distiller = await prisma.$transaction(async (tx) => {
      const distiller = await tx.distiller.upsert({
        where: {
          name: data.name,
        },
        update: {},
        create: data,
      });

      await tx.change.create({
        data: {
          objectType: "distiller",
          objectId: distiller.id,
          userId: req.user.id,
          data: JSON.stringify(data),
        },
      });

      return distiller;
    });

    res.status(201).send(distiller);
  },
};
