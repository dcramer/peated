import { eq, inArray, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import {
  Category,
  bottles,
  bottlesToDistillers,
  changes,
  entities,
} from "../db/schema";
import { EntityInput, upsertEntity } from "../lib/db";
import { requireAuth } from "../middleware/auth";

type BottleInput = {
  name: string;
  category: Category;
  brand: EntityInput;
  distillers: EntityInput[];
  statedAge?: number;
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
  preHandler: [requireAuth],
  handler: async (req, res) => {
    const body = req.body;

    const bottle = await db.transaction(async (tx) => {
      const [brand] =
        typeof body.brand === "number"
          ? await tx.select().from(entities).where(eq(entities.id, body.brand))
          : await tx
              .insert(entities)
              .values({
                name: body.brand.name,
                country: body.brand.country || null,
                region: body.brand.region || null,
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
          const distUpsert = await upsertEntity({
            db: tx,
            data: distData,
            userId: req.user.id,
            type: "distiller",
          });
          if (!distUpsert) {
            return res
              .status(400)
              .send({ error: "Could not identify distiller" });
          }
          await tx.insert(bottlesToDistillers).values({
            bottleId: bottle.id,
            distillerId: distUpsert.id,
          });

          distillerIds.push(distUpsert.id);
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

      await tx
        .update(entities)
        .set({ totalBottles: sql`${entities.totalBottles} + 1` })
        .where(
          inArray(
            entities.id,
            Array.from(new Set([brand.id, ...distillerIds])),
          ),
        );

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
