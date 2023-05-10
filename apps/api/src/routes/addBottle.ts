import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { validateRequest } from "../middleware/auth";
import {
  bottles,
  bottlesToDistillers,
  changes,
  entities,
  categoryEnum,
} from "../db/schema";
import { db } from "../lib/db";
import { eq } from "drizzle-orm";

type BottleInput = {
  name: string;
  category: categoryEnum;
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
      $ref: "bottleSchema",
      required: ["name", "brand"],
    },
  },
  preHandler: [validateRequest],
  handler: async (req, res) => {
    const body = req.body;

    const bottle = await db.transaction(async (tx) => {
      const [brand] =
        typeof body.brand === "number"
          ? await tx.select().from(entities).where(eq(entities.id, body.brand))
          : await tx
              .insert(entities)
              .values({
                ...body.brand,
                type: ["brand"],
                createdById: req.user.id,
              })
              .onConflictDoNothing()
              .returning();

      if (typeof body.brand !== "number") {
        await tx.insert(changes).values({
          objectType: "entity",
          objectId: brand.id,
          createdById: req.user.id,
          data: JSON.stringify(body.brand),
        });
      }

      const [bottle] = await tx
        .insert(bottles)
        .values({
          name: body.name,
          statedAge: body.statedAge || null,
          category: body.category || null,
          brandId: brand.id,
          createdById: req.user.id,
        })
        .returning();

      const distillerIds: number[] = [];
      if (body.distillers)
        for (const distData of body.distillers) {
          let distillerId: number =
            typeof distData === "number"
              ? distData
              : (
                  await tx
                    .insert(entities)
                    .values({
                      ...distData,
                      type: ["distiller"],
                      createdById: req.user.id,
                    })
                    .onConflictDoNothing()
                    .returning()
                )[0].id;

          if (typeof distData !== "number") {
            await tx.insert(changes).values({
              objectType: "entity",
              objectId: distillerId,
              createdById: req.user.id,
              data: JSON.stringify(distData),
            });
          }

          await tx.insert(bottlesToDistillers).values({
            bottleId: bottle.id,
            distillerId: distillerId,
          });

          distillerIds.push(distillerId);
        }

      await tx.insert(changes).create({
        objectType: "bottle",
        objectId: bottle.id,
        userId: req.user.id,
        data: JSON.stringify({
          ...bottle,
          distillerIds,
        }),
      });

      return bottle;
    });

    res.status(201).send(bottle);
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Body: BottleInput;
  }
>;
