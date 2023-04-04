import type { RouteOptions } from "fastify";
import { prisma } from "../lib/db";
import { Bottle, Bottler, Brand, Prisma, Distiller } from "@prisma/client";
import { IncomingMessage, Server, ServerResponse } from "http";

export const listBottles: RouteOptions<
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
  url: "/bottles",
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
      res.status(404).send({ error: "Not found" });
    } else {
      res.send(bottle);
    }
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
            "single_grain",
            "single_malt",
            "spirit",
          ],
        },
        abv: { type: "number" },
        stagedAge: { type: "number" },
      },
    },
  },
  handler: async (req, res) => {
    const body = req.body;
    // gross syntax, whats better?
    const data: Prisma.BottleUncheckedCreateInput = (({
      brand,
      distiller,
      ...d
    }: any) => d)(body);

    if (body.brand) {
      let brand: Brand | null;

      if (typeof body.brand === "number") {
        brand = await prisma.brand.findUnique({
          where: { id: body.brand },
        });
      } else if (body.brand satisfies Partial<Bottler>) {
        brand = await prisma.brand.upsert({
          where: {
            name: body.brand.name,
          },
          update: {},
          create: {
            name: body.brand.name,
            country: body.brand.country,
            region: body.brand.region,
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
      let distiller: Distiller | null;

      if (typeof body.distiller === "number") {
        distiller = await prisma.distiller.findUnique({
          where: { id: body.distiller },
        });
      } else if (body.distiller satisfies Partial<Bottler>) {
        distiller = await prisma.distiller.upsert({
          where: {
            name: body.distiller.name,
          },
          update: {},
          create: {
            name: body.distiller.name,
            country: body.distiller.country,
            region: body.distiller.region,
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

    const bottle = await prisma.bottle.create({
      data,
      include: {
        brand: true,
      },
    });
    res.status(201).send(bottle);
  },
};
