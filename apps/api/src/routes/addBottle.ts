import { BottleInputSchema, BottleSchema } from "@peated/shared/schemas";
import { inArray, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { db } from "../db";
import {
  Bottle,
  Entity,
  bottles,
  bottlesToDistillers,
  changes,
  entities,
} from "../db/schema";
import { upsertEntity } from "../lib/db";
import { serialize } from "../lib/serializers";
import { BottleSerializer } from "../lib/serializers/bottle";
import { requireAuth } from "../middleware/auth";

const fixBottleName = (name: string, age?: number | null): string => {
  // try to ease UX and normalize common name components
  if (age && name == `${age}`) return `${age}-year-old`;
  return name
    .replace(" years old", "-year-old")
    .replace(" year old", "-year-old")
    .replace("-years-old", "-year-old")
    .replace(" years", "-year-old")
    .replace(" year", "-year-old");
};

export default {
  method: "POST",
  url: "/bottles",
  schema: {
    body: zodToJsonSchema(BottleInputSchema),
    response: {
      201: zodToJsonSchema(BottleSchema),
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    const body = req.body;

    const name = fixBottleName(body.name, body.statedAge);
    if (
      (name.indexOf("-year-old") !== -1 ||
        name.indexOf("-years-old") !== -1 ||
        name.indexOf("year old") !== -1 ||
        name.indexOf("years old") !== -1) &&
      !body.statedAge
    ) {
      res
        .status(400)
        .send({ error: "You should include the Stated Age of the bottle" });
      return;
    }

    const bottle: Bottle | undefined = await db.transaction(async (tx) => {
      const brandUpsert = await upsertEntity({
        db: tx,
        data: body.brand,
        type: "brand",
        userId: req.user.id,
      });

      if (!brandUpsert) {
        res.status(400).send({ error: "Could not identify brand" });
        return;
      }

      const brand = brandUpsert.result;

      let bottler: Entity | null = null;
      if (body.bottler) {
        const bottlerUpsert = await upsertEntity({
          db: tx,
          data: body.bottler,
          type: "bottler",
          userId: req.user.id,
        });
        if (bottlerUpsert) {
          bottler = bottlerUpsert.result;
        } else {
          res.status(400).send({ error: "Could not identify bottler" });
          return;
        }
      }

      let bottle: Bottle | undefined;
      try {
        [bottle] = await tx
          .insert(bottles)
          .values({
            name,
            series: body.series || null,
            statedAge: body.statedAge || null,
            category: body.category || null,
            brandId: brand.id,
            bottlerId: bottler?.id || null,
            createdById: req.user.id,
          })
          .returning();
      } catch (err: any) {
        if (err?.code === "23505" && err?.constraint === "bottle_brand_unq") {
          res
            .status(409)
            .send({ error: "Bottle with name already exists under brand" });
          return;
        }
        throw err;
      }
      if (!bottle) {
        return;
      }

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

    if (!bottle) {
      return res.status(500).send({ error: "Failed to create bottle" });
    }

    res.status(201).send(await serialize(BottleSerializer, bottle, req.user));
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Body: z.infer<typeof BottleInputSchema>;
  }
>;
