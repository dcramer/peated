import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { validateRequest } from "../middleware/auth";
import {
  bottles,
  bottlesToDistillers,
  changes,
  entities,
  Category,
} from "../db/schema";
import { db } from "../lib/db";
import { eq } from "drizzle-orm";

type BottleInput = {
  name: string;
  category: Category;
  brand: number | { name: string; country: string; region?: string };
  distillers: (number | { name: string; country: string; region?: string })[];
  statedAge?: number;
};

const getDistillerId = async (tx: any, distData: any, userId: number) => {
  if (distData === "number") {
    let [distiller] = await tx
      .select()
      .from(entities)
      .where(eq(entities.id, distData));
    return distiller?.id;
  }

  let [distiller] = await tx
    .insert(entities)
    .values({
      ...distData,
      type: ["distiller"],
      createdById: userId,
    })
    .onConflictDoNothing()
    .returning();

  if (distiller) {
    return distiller.id;
  }

  let [distillerQ] = await tx
    .select()
    .from(entities)
    .where(eq(entities.name, distData.name));

  if (!distillerQ) {
    return null;
  }
  return distillerQ.id;
};

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
      if (!brand) {
        return res.status(400).send({ error: "Could not identify brand" });
      }

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
          let distillerId = await getDistillerId(tx, distData, req.user.id);
          if (!distillerId) {
            return res
              .status(400)
              .send({ error: "Could not identify distiller" });
          }
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

      await tx.insert(changes).values({
        objectType: "bottle",
        objectId: bottle.id,
        createdById: req.user.id,
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
