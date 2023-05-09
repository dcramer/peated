import type { RouteOptions } from "fastify";
import { prisma } from "../lib/db";
import { Category, Prisma } from "@prisma/client";
import { IncomingMessage, Server, ServerResponse } from "http";
import { validateRequest } from "../middleware/auth";
import { omit } from "../lib/filter";
import config from "../config";
import { buildPageLink } from "../lib/paging";

const BottleProperties = {
  name: { type: "string" },
  brand: {
    oneOf: [
      { type: "number" },
      {
        type: "object",
        required: ["name", "country"],
        properties: {
          id: {
            type: "number",
          },
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
  distillers: {
    type: "array",
    items: {
      oneOf: [
        { type: "number" },
        {
          type: "object",
          required: ["name", "country"],
          properties: {
            id: {
              type: "number",
            },
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
  },
  category: {
    type: "string",
    enum: [
      "",
      "blend",
      "bourbon",
      "rye",
      "single_grain",
      "single_malt",
      "spirit",
    ],
  },
  statedAge: { type: "number" },
};

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
      sort?: "name";
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
        sort: { type: "string" },
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
        contains: query,
        mode: "insensitive",
      };
    }
    if (req.query.brand) {
      where.brandId = req.query.brand;
    }
    if (req.query.distiller) {
      where.distillers = { some: { id: req.query.distiller } };
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
        orderBy = {
          checkins: {
            _count: "desc",
          },
        };
    }

    const results = await prisma.bottle.findMany({
      include: {
        brand: true,
        distillers: true,
        _count: {
          select: { checkins: true },
        },
      },
      where,
      skip: offset,
      take: limit + 1,
      orderBy,
    });

    res.send({
      results: results.slice(0, limit),
      rel: {
        nextPage: results.length > limit ? page + 1 : null,
        next:
          results.length > limit
            ? buildPageLink(req.routeOptions.url, req.query, page + 1)
            : null,
        prevPage: page > 1 ? page - 1 : null,
        prev:
          page > 1
            ? buildPageLink(req.routeOptions.url, req.query, page - 1)
            : null,
      },
    });
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
        distillers: true,
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

type BottleInput = {
  name: string;
  category: Category;
  brand: number | { name: string; country: string; region?: string };
  distillers: (number | { name: string; country: string; region?: string })[];
  statedAge?: number;
};

class InvalidValue extends Error {}

const getBrandParam = async (req: any, value: BottleInput["brand"]) => {
  if (typeof value === "number") {
    if (!(await prisma.brand.findUnique({ where: { id: value } }))) {
      throw new InvalidValue(`${value} is not a valid brand ID`);
    }
  }

  if (typeof value === "number") {
    return { connect: { id: value } };
  }
  return {
    create: {
      name: value.name,
      country: value.country,
      region: value.region,
      public: req.user.admin,
      createdById: req.user.id,
    },
  };
};

const getDistillerParam = async (
  req: any,
  value: BottleInput["distillers"]
) => {
  if (!value) return;

  for (const d of value) {
    if (typeof d === "number") {
      if (!(await prisma.distiller.findUnique({ where: { id: d } }))) {
        throw new InvalidValue(`${value} is not a valid distiller ID`);
      }
    }
  }

  return {
    connect: value
      .filter((d) => typeof d === "number")
      .map((d: any) => ({ id: d })),
    create: value
      .filter((d) => typeof d !== "number")
      // how to type this?
      .map((d: any) => ({
        name: d.name,
        country: d.country,
        region: d.region,
        public: req.user.admin,
        createdById: req.user.id,
      })),
  };
};

export const addBottle: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Body: BottleInput;
  }
> = {
  method: "POST",
  url: "/bottles",
  schema: {
    body: {
      type: "object",
      required: ["name", "brand"],
      properties: BottleProperties,
    },
  },
  preHandler: [validateRequest],
  handler: async (req, res) => {
    const body = req.body;

    const bottleData: Prisma.BottleCreateInput = {
      name: body.name,
      brand: await getBrandParam(req, body.brand),
      distillers: await getDistillerParam(req, body.distillers),
      statedAge: body.statedAge || null,
      category: body.category || null,
      public: req.user.admin,
      createdBy: { connect: { id: req.user.id } },
    };

    const bottle = await prisma.$transaction(async (tx) => {
      const bottle = await tx.bottle.create({
        data: bottleData,
        include: {
          brand: true,
          distillers: true,
        },
      });

      if (body.distillers)
        body.distillers
          .filter((d) => typeof d !== "number")
          .forEach(async ({ name }: any) => {
            const distiller = bottle.distillers.find((d2) => d2.name === name);
            if (!distiller)
              throw new Error(`Unable to find connected distiller: ${name}`);
            await tx.change.create({
              data: {
                objectType: "distiller",
                objectId: distiller.id,
                userId: req.user.id,
                data: JSON.stringify(distiller),
              },
            });
          });

      if (body.brand && typeof body.brand !== "number") {
        await tx.change.create({
          data: {
            objectType: "brand",
            objectId: bottle.brandId,
            userId: req.user.id,
            data: JSON.stringify(bottle.brand),
          },
        });
      }

      await tx.change.create({
        data: {
          objectType: "bottle",
          objectId: bottle.id,
          userId: req.user.id,
          data: JSON.stringify({
            ...omit(bottleData, "distillers", "brand", "createdBy"),
            brandId: bottle.brand.id,
            distillerIds: bottle.distillers.map((d) => d.id),
          }),
        },
      });

      return bottle;
    });

    res.status(201).send(bottle);
  },
};

export const editBottle: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      bottleId: number;
    };
    Body: Partial<BottleInput>;
  }
> = {
  method: "PUT",
  url: "/bottles/:bottleId",
  schema: {
    params: {
      type: "object",
      required: ["bottleId"],
      properties: {
        bottleId: { type: "number" },
      },
    },
    body: {
      type: "object",
      properties: BottleProperties,
    },
  },
  preHandler: [validateRequest],
  handler: async (req, res) => {
    const bottle = await prisma.bottle.findUnique({
      include: {
        brand: true,
        distillers: true,
      },
      where: {
        id: req.params.bottleId,
      },
    });
    if (!bottle) {
      return res.status(404).send({ error: "Not found" });
    }

    const body = req.body;
    const bottleData: Partial<Prisma.BottleCreateInput> = {};

    if (body.name && body.name !== bottle.name) {
      bottleData.name = body.name;
    }

    if (body.category && body.category !== bottle.category) {
      bottleData.category = body.category;
    }

    if (body.brand) {
      if (typeof body.brand === "number") {
        if (body.brand !== bottle.brandId) {
          bottleData.brand = { connect: { id: body.brand } };
        }
      } else {
        bottleData.brand = await getBrandParam(req, body.brand);
      }
    }

    // TODO: only capture changes
    if (body.distillers) {
      const distillersParam = await getDistillerParam(req, body.distillers);
      if (distillersParam) {
        const newDistillersParam = {
          ...distillersParam,
          disconnect: bottle.distillers
            .filter(
              (d) => !distillersParam.connect.find((d2) => d2.id === d.id)
            )
            .map((d) => ({ id: d.id })),
        };
      }

      bottleData.distillers = distillersParam;
    }

    const newBottle = await prisma.$transaction(async (tx) => {
      const newBottle = await tx.bottle.update({
        data: bottleData,
        where: {
          id: bottle.id,
        },
        include: {
          brand: true,
          distillers: true,
        },
      });

      if (body.distillers)
        body.distillers
          .filter((d) => typeof d !== "number")
          .forEach(async ({ name }: any) => {
            const distiller = bottle.distillers.find((d2) => d2.name === name);
            if (!distiller)
              throw new Error(`Unable to find connected distiller: ${name}`);
            await tx.change.create({
              data: {
                objectType: "distiller",
                objectId: distiller.id,
                userId: req.user.id,
                data: JSON.stringify(distiller),
              },
            });
          });

      if (body.brand && typeof body.brand !== "number") {
        await tx.change.create({
          data: {
            objectType: "brand",
            objectId: bottle.brandId,
            userId: req.user.id,
            data: JSON.stringify(bottle.brand),
          },
        });
      }

      await tx.change.create({
        data: {
          objectType: "bottle",
          objectId: newBottle.id,
          userId: req.user.id,
          data: JSON.stringify({
            ...omit(bottleData, "distillers", "brand", "createdBy"),
            brandId: newBottle.brand.id,
            distillerIds: newBottle.distillers.map((d) => d.id),
          }),
        },
      });

      return newBottle;
    });

    res.status(201).send(newBottle);
  },
};
