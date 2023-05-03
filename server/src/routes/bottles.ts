import type { RouteOptions } from "fastify";
import { prisma } from "../lib/db";
import { Bottle, Brand, Prisma, Distiller } from "@prisma/client";
import { IncomingMessage, Server, ServerResponse } from "http";
import { validateRequest } from "../middleware/auth";

export const listBottles: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Querystring: {
      query?: string;
      page?: number;
      brand?: number;
      distiller?: number;
    };
  }
> = {
  method: "GET",
  url: "/bottles",
  schema: {
    querystring: {
      type: "object",
      properties: {
        query: { type: "string" },
        page: { type: "number" },
        brand: { type: "number" },
        distiller: { type: "number" },
      },
    },
  },
  handler: async (req, res) => {
    const page = req.query.page || 1;
    const query = req.query.query || "";

    const limit = 100;
    const offset = (page - 1) * limit;

    const where: Prisma.BottleWhereInput = {};
    if (query) {
      where.name = {
        search: query.split(" ").join(" & "),
        mode: "insensitive",
      };
    }
    if (req.query.brand) {
      where.brandId = req.query.brand;
    }
    if (req.query.distiller) {
      where.distillerId = req.query.distiller;
    }

    where.OR = [{ public: true }];
    if (req.user) {
      where.OR.push({ createdById: req.user.id });
    }

    const results = await prisma.bottle.findMany({
      include: {
        brand: true,
        distiller: true,
      },
      where,
      skip: offset,
      take: limit,
      orderBy: { name: "asc" },
    });
    res.send(results);
  },
};

export const getBottle: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      bottleId: number;
    };
  }
> = {
  method: "GET",
  url: "/bottles/:bottleId",
  schema: {
    params: {
      type: "object",
      required: ["bottleId"],
      properties: {
        bottleId: { type: "number" },
      },
    },
  },
  handler: async (req, res) => {
    const bottle = await prisma.bottle.findUnique({
      include: {
        brand: true,
        distiller: true,
      },
      where: {
        id: req.params.bottleId,
      },
    });
    if (!bottle) {
      return res.status(404).send({ error: "Not found" });
    }
    const totalCheckins = await prisma.checkin.count({
      where: { bottleId: bottle.id },
    });
    const [{ count: totalPeople }] = await prisma.$queryRaw<
      { count: number }[]
    >`SELECT COUNT(DISTINCT "userId") FROM "checkin" WHERE "bottleId" = ${bottle.id}`;
    const [{ avg: avgRating }] = await prisma.$queryRaw<
      { avg: number }[]
    >`SELECT AVG("rating") FROM "checkin" WHERE "bottleId" = ${bottle.id}`;

    res.send({
      ...bottle,
      stats: {
        checkins: totalCheckins,
        avgRating: avgRating,
        people: totalPeople,
      },
    });
  },
};

export const addBottle: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Body: Bottle & {
      brand: number | { name: string; country: string; region?: string };
      distiller: number | { name: string; country: string; region?: string };
    };
  }
> = {
  method: "POST",
  url: "/bottles",
  schema: {
    body: {
      type: "object",
      required: ["name", "brand"],
      properties: {
        name: { type: "string" },
        brand: {
          oneOf: [
            { type: "number" },
            {
              type: "object",
              required: ["name", "country"],
              properties: {
                name: {
                  type: "string",
                },
                country: {
                  type: "string",
                },
                region: {
                  type: "string",
                },
              },
            },
          ],
        },
        distiller: {
          oneOf: [
            { type: "number" },
            {
              type: "object",
              required: ["name", "country"],
              properties: {
                name: {
                  type: "string",
                },
                country: {
                  type: "string",
                },
                region: {
                  type: "string",
                },
              },
            },
          ],
        },
        series: { type: "string" },
        category: {
          type: "string",
          enum: [
            "blend",
            "blended_grain",
            "blended_malt",
            "blended_scotch",
            "bourbon",
            "rye",
            "single_grain",
            "single_malt",
            "spirit",
          ],
        },
        abv: { type: "number" },
        statedAge: { type: "number" },
      },
    },
  },
  preHandler: [validateRequest],
  handler: async (req, res) => {
    const body = req.body;
    // gross syntax, whats better?
    const data: Prisma.BottleUncheckedCreateInput = (({
      brand,
      distiller,
      ...d
    }: any) => d)(body);

    if (body.brand) {
      let brand: Brand | null = null;

      if (typeof body.brand === "number") {
        brand = await prisma.brand.findUnique({
          where: { id: body.brand },
        });
      } else if (body.brand satisfies Partial<Brand>) {
        brand = await prisma.brand.upsert({
          where: {
            name: body.brand.name,
          },
          update: {},
          create: {
            name: body.brand.name,
            country: body.brand.country,
            region: body.brand.region,
            public: req.user.admin,
            createdById: req.user.id,
          },
        });
      }

      if (!brand) {
        res.status(400).send({ error: "Invalid brand" });
        return;
      } else {
        data.brandId = brand.id;
      }
    }

    if (body.distiller) {
      let distiller: Distiller | null = null;

      if (typeof body.distiller === "number") {
        distiller = await prisma.distiller.findUnique({
          where: { id: body.distiller },
        });
      } else if (body.distiller satisfies Partial<Brand>) {
        distiller = await prisma.distiller.upsert({
          where: {
            name: body.distiller.name,
          },
          update: {},
          create: {
            name: body.distiller.name,
            country: body.distiller.country,
            region: body.distiller.region,
            public: req.user.admin,
            createdById: req.user.id,
          },
        });
      }

      if (!distiller) {
        res.status(400).send({ error: "Invalid distiller" });
        return;
      } else {
        data.distillerId = distiller.id;
      }
    }

    data.createdById = req.user.id;
    data.public = req.user.admin;

    const bottle = await prisma.bottle.create({
      data,
      include: {
        brand: true,
      },
    });
    res.status(201).send(bottle);
  },
};
