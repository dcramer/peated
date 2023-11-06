import { inArray, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import type { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { normalizeBottleName } from "@peated/core/lib/normalize";
import { BottleInputSchema, BottleSchema } from "@peated/core/schemas";

import { db } from "@peated/core/db";
import type { Bottle, Entity } from "@peated/core/db/schema";
import {
  bottles,
  bottlesToDistillers,
  changes,
  entities,
} from "@peated/core/db/schema";
import pushJob from "@peated/core/jobs";
import { notEmpty } from "@peated/core/lib/filter";
import { serialize } from "@peated/core/serializers";
import { BottleSerializer } from "@peated/core/serializers/bottle";
import { upsertEntity } from "../lib/db";
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
    if (!req.user) return res.status(401).send({ error: "Unauthorized" });

    const body = req.body;

    let name = normalizeBottleName(body.name, body.statedAge);
    if (name.indexOf("-year-old") !== -1 && !body.statedAge) {
      res
        .status(400)
        .send({ error: "You should include the Stated Age of the bottle" });
      return;
    }

    const user = req.user;
    const bottle: Bottle | undefined = await db.transaction(async (tx) => {
      const brandUpsert = await upsertEntity({
        db: tx,
        data: body.brand,
        type: "brand",
        userId: user.id,
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
          userId: user.id,
        });
        if (bottlerUpsert) {
          bottler = bottlerUpsert.result;
        } else {
          res.status(400).send({ error: "Could not identify bottler" });
          return;
        }
      }

      const fullName = [brand.name, name].filter(Boolean).join(" ");

      let bottle: Bottle | undefined;
      try {
        [bottle] = await tx
          .insert(bottles)
          .values({
            name,
            fullName,
            statedAge: body.statedAge || null,
            category: body.category || null,
            brandId: brand.id,
            bottlerId: bottler?.id || null,
            createdById: user.id,
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
            userId: user.id,
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
        createdById: user.id,
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

    await pushJob("GenerateBottleDetails", { bottleId: bottle.id });

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
