import type { RouteOptions } from "fastify";
import { prisma } from "../lib/db";
import { IncomingMessage, Server, ServerResponse } from "http";
import { Brand, Prisma } from "@prisma/client";
import { validateRequest } from "../middleware/auth";

export const listBrands: RouteOptions<
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
  url: "/brands",
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
        contains: query,
        mode: "insensitive",
      };
    }

    where.OR = [{ public: true }];
    if (req.user) {
      where.OR.push({ createdById: req.user.id });
    }

    const results = await prisma.brand.findMany({
      where,
      skip: offset,
      take: limit,
      // TODO(dcramer): we want to sort by checkins
      orderBy: {
        bottles: {
          _count: "desc",
        },
      },
    });
    res.send(results);
  },
};

export const getBrand: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      brandId: number;
    };
  }
> = {
  method: "GET",
  url: "/brands/:brandId",
  schema: {
    params: {
      type: "object",
      required: ["brandId"],
      properties: {
        brandId: { type: "number" },
      },
    },
  },
  handler: async (req, res) => {
    const brand = await prisma.brand.findUnique({
      where: {
        id: req.params.brandId,
      },
    });
    if (!brand) {
      return res.status(404).send({ error: "Not found" });
    }

    const totalBottles = await prisma.bottle.count({
      where: { brandId: brand.id },
    });

    res.send({
      ...brand,
      stats: {
        bottles: totalBottles,
      },
    });
  },
};

export const addBrand: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Body: Brand;
  }
> = {
  method: "POST",
  url: "/brands",
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
    const data: Prisma.BrandUncheckedCreateInput = (({ ...d }: any) => d)(body);

    data.createdById = req.user.id;
    data.public = req.user.admin;

    const brand = await prisma.$transaction(async (tx) => {
      const brand = await tx.brand.upsert({
        where: {
          name: data.name,
        },
        update: {},
        create: data,
      });

      await tx.change.create({
        data: {
          objectType: "brand",
          objectId: brand.id,
          userId: req.user.id,
          data: JSON.stringify(data),
        },
      });

      return brand;
    });

    res.status(201).send(brand);
  },
};
