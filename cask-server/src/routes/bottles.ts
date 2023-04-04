import type { RouteOptions } from "fastify";
import { prisma } from "../lib/db";
import { Bottle } from "@prisma/client";
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

export const addBottle: RouteOptions<Server, IncomingMessage, ServerResponse> =
  {
    method: "POST",
    url: "/bottles",
    schema: {
      body: {
        type: "object",
        required: ["name", "producerId"],
        properties: {
          name: { type: "string" },
          brandId: { type: "number" },
          bottlerId: { type: "number" },
          producerId: { type: "number" },
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
      const data = req.body as Bottle;
      if (data.producerId) {
        const producer = await prisma.producer.findUnique({
          where: { id: data.producerId },
        });
        if (!producer) {
          res.status(400).send({ error: "Invalid producer" });
        }
      }

      if (data.bottlerId) {
        const bottler = await prisma.bottler.findUnique({
          where: { id: data.bottlerId },
        });
        if (!bottler) {
          res.status(400).send({ error: "Invalid bottler" });
        }
      }

      if (data.brandId) {
        const brand = await prisma.brand.findUnique({
          where: { id: data.brandId },
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
