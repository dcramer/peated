import { inArray, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import type { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { normalizeBottleName } from "@peated/shared/lib/normalize";
import { BottleInputSchema, BottleSchema } from "@peated/shared/schemas";

import { db } from "../db";
import type { Bottle, Entity } from "../db/schema";
import { bottles, bottlesToDistillers, changes, entities } from "../db/schema";
import { upsertEntity } from "../lib/db";
import { notEmpty } from "../lib/filter";
import { serialize } from "../lib/serializers";
import { BottleSerializer } from "../lib/serializers/bottle";
import { requireAuth } from "../middleware/auth";

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

    let name = normalizeBottleName(body.name, body.statedAge);
    if (name.indexOf("-year-old") !== -1 && !body.statedAge) {
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

      // TODO: we need to pull all this name uniform logic into a shared helper, as this
      // is missing from updateBottle
      if (name.indexOf(brand.name) === 0) {
        name = name.substring(brand.name.length + 1);
      }

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
            fullName: [brand.name, name].filter(Boolean).join(" "),
            statedAge: body.statedAge || null,
            category: body.category || null,
            brandId: brand.id,
            bottlerId: bottler?.id || null,
            createdById: req.user.id,
          })
          .returning();
      } catch (err: any) {
        if (
          err?.code === "23505" &&
          (err?.constraint === "bottle_brand_unq" ||
            err?.constraint === "bottle_name_unq")
        ) {
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
        createdAt: bottle.createdAt,
        createdById: req.user.id,
        displayName: bottle.fullName,
        type: "add",
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
            Array.from(
              new Set([brand.id, ...distillerIds, bottler?.id]),
            ).filter(notEmpty),
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
