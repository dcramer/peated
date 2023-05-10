import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { validateRequest } from "../middleware/auth";
import { omit } from "../lib/filter";
import { Category, NewBottle, bottles } from "../db/schema";
import { db } from "../lib/db";
import { eq, sql } from "drizzle-orm";

type BottleInput = {
  name: string;
  category: Category;
  brand: number | { name: string; country: string; region?: string };
  distillers: (number | { name: string; country: string; region?: string })[];
  statedAge?: number;
};

class InvalidValue extends Error {}

// const getBrandParam = async (req: any, value: BottleInput["brand"]) => {
//   if (typeof value === "number") {
//     if (
//       (await db.select().from(entities).where(eq(entities.id, value)).limit(1))
//         .length === 0
//     ) {
//       throw new InvalidValue(`${value} is not a valid brand ID`);
//     }
//   }

//   if (typeof value === "number") {
//     return { connect: { id: value } };
//   }
//   return {
//     create: {
//       name: value.name,
//       country: value.country,
//       region: value.region,
//       public: req.user.admin,
//       createdById: req.user.id,
//     },
//   };
// };

// const getDistillerParam = async (
//   req: any,
//   value: BottleInput["distillers"]
// ) => {
//   if (!value) return;

//   for (const d of value) {
//     if (typeof d === "number") {
//       if (!(await prisma.distiller.findUnique({ where: { id: d } }))) {
//         throw new InvalidValue(`${value} is not a valid distiller ID`);
//       }
//     }
//   }

//   return {
//     connect: value
//       .filter((d) => typeof d === "number")
//       .map((d: any) => ({ id: d })),
//     create: value
//       .filter((d) => typeof d !== "number")
//       // how to type this?
//       .map((d: any) => ({
//         name: d.name,
//         country: d.country,
//         region: d.region,
//         public: req.user.admin,
//         createdById: req.user.id,
//       })),
//   };
// };

export default {
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

    const bottleData: NewBottle = {
      name: body.name,
      statedAge: body.statedAge || null,
      category: body.category || null,
      createdById: req.user.id,
    };

    const bottle = await db.transaction(async (tx) => {
      const [bottle] = await tx.insert(bottles).values(bottleData).returning();

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
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Body: BottleInput;
  }
>;
