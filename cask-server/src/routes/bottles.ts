import type { RouteOptions } from "fastify";
import { prisma } from "../lib/db";
import { Bottle, Bottler, Producer } from "@prisma/client";
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
  url: "/bottle/:bottleId",
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
      brand: number | { name: string };
      bottler: number | { name: string };
      producer: number | { name: string; country: string; region?: string };
    };
  }
> = {
  method: "POST",
  url: "/bottles",
  schema: {
    body: {
      type: "object",
      required: ["name", "producer"],
      properties: {
        name: { type: "string" },
        brand: {
          oneOf: [
            { type: "number" },
            {
              type: "object",
              required: ["name"],
              properties: {
                name: {
                  type: "string",
                },
              },
            },
          ],
        },
        bottler: {
          oneOf: [
            { type: "number" },
            {
              type: "object",
              required: ["name"],
              properties: {
                name: {
                  type: "string",
                },
              },
            },
          ],
        },
        producer: {
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
        category: {
          type: "string",
          enum: ["blend", "blended_malt", "single_malt", "spirit"],
        },
        abv: { type: "number" },
        stagedAge: { type: "number" },
        vintageYear: { type: "number" },
        bottleYear: { type: "number" },
        series: { type: "string" },
        caskType: { type: "string" },
        caskNumber: { type: "string" },
        totalBottles: { type: "number" },
        mashBill: {
          type: "object",
          properties: {
            barley: { type: "number" },
            corn: { type: "number" },
            rye: { type: "number" },
            wheat: { type: "number" },
          },
        },
      },
    },
  },
  handler: async (req, res) => {
    const body = req.body;
    // gross syntax, whats better?
    const data: Partial<Bottle> = (({ producer, bottler, brand, ...d }: any) =>
      d)(body);

    if (body.producer) {
      let producer: Producer | null;

      if (typeof body.producer === "number") {
        producer = await prisma.producer.findUnique({
          where: { id: body.producer },
        });
      } else if (body.producer satisfies Partial<Producer>) {
        producer = await prisma.producer.upsert({
          where: {
            name_country: {
              name: body.producer.name,
              country: body.producer.country,
            },
          },
          update: {
            region: body.producer.region || null,
          },
          create: {
            name: body.producer.name,
            country: body.producer.country,
            region: body.producer.region || null,
          },
        });
      }

      if (!producer) {
        res.status(400).send({ error: "Invalid producer" });
      } else {
        data.producerId = producer.id;
      }
    }

    if (body.bottler) {
      let bottler: Bottler | null;

      if (typeof body.bottler === "number") {
        bottler = await prisma.bottler.findUnique({
          where: { id: body.producer },
        });
      } else if (body.bottler satisfies Partial<Bottler>) {
        bottler = await prisma.bottler.upsert({
          where: {
            name: body.bottler.name,
          },
          create: {
            name: body.bottler.name,
          },
          update: {},
        });
      }

      if (!bottler) {
        res.status(400).send({ error: "Invalid bottler" });
      } else {
        data.bottlerId = bottler.id;
      }
    }

    if (body.brand) {
      let brand: Brand | null;

      if (typeof body.brand === "number") {
        brand = await prisma.producer.findUnique({
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
          },
        });
      }

      if (!brand) {
        res.status(400).send({ error: "Invalid brand" });
      } else {
        data.brandId = brand.id;
      }
    }
    if (data.brand) {
      const brand = await prisma.brand.findUnique({
        where: { id: data.brand },
      });
      if (!brand) {
        res.status(400).send({ error: "Invalid brand" });
      }
    }

    const bottle = await prisma.bottle.create({
      data,
    });
    res.status(201).send(bottle);
  },
};
