import { BottleInputSchema, BottleSchema } from "@peated/shared/schemas";
import { and, eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { db } from "../db";
import {
  Bottle,
  bottles,
  bottlesToDistillers,
  changes,
  entities,
} from "../db/schema";
import { upsertEntity } from "../lib/db";
import { serialize } from "../lib/serializers";
import { BottleSerializer } from "../lib/serializers/bottle";
import { requireMod } from "../middleware/auth";

export default {
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
    body: zodToJsonSchema(BottleInputSchema.partial()),
    response: {
      200: zodToJsonSchema(BottleSchema),
    },
  },
  preHandler: [requireMod],
  handler: async (req, res) => {
    const bottle = await db.query.bottles.findFirst({
      where: (bottles, { eq }) => eq(entities.id, req.params.bottleId),
      with: {
        brand: true,
        bottler: true,
        bottlesToDistillers: {
          with: {
            distiller: true,
          },
        },
      },
    });
    if (!bottle) {
      return res.status(404).send({ error: "Not found" });
    }

    const body = req.body;
    const bottleData: { [name: string]: any } = {};

    if (body.name && body.name !== bottle.name) {
      bottleData.name = body.name;
    }
    if (body.category !== undefined && body.category !== bottle.category) {
      bottleData.category = body.category;
    }
    if (body.statedAge !== undefined && body.statedAge !== bottle.statedAge) {
      bottleData.statedAge = body.statedAge;
    }

    const newBottle = await db.transaction(async (tx) => {
      let newBottle: Bottle | undefined;
      try {
        newBottle = Object.values(bottleData).length
          ? (
              await tx
                .update(bottles)
                .set(bottleData)
                .where(eq(bottles.id, bottle.id))
                .returning()
            )[0]
          : bottle;
      } catch (err: any) {
        if (err?.code === "23505" && err?.constraint === "bottle_brand_unq") {
          res
            .status(409)
            .send({ error: "Bottle with name already exists under brand" });
          return;
        }
        throw err;
      }

      if (body.brand) {
        if (
          typeof body.brand === "number"
            ? body.brand !== bottle.brand.id
            : body.brand.name !== bottle.brand.name
        ) {
          const brandUpsert = await upsertEntity({
            db: tx,
            data: body.brand,
            userId: req.user.id,
            type: "brand",
          });
          if (!brandUpsert)
            throw new Error(`Unable to find entity: ${body.brand}`);
          if (brandUpsert.id !== bottle.brandId) {
            bottleData.brandId = brandUpsert.id;
          }
        }
      }

      if (body.bottler) {
        if (
          typeof body.bottler === "number"
            ? body.bottler !== bottle.bottler?.id
            : body.bottler.name !== bottle.bottler?.name
        ) {
          const bottlerUpsert = await upsertEntity({
            db: tx,
            data: body.bottler,
            userId: req.user.id,
            type: "bottler",
          });
          if (!bottlerUpsert)
            throw new Error(`Unable to find entity: ${body.bottler}`);
          if (bottlerUpsert.id !== bottle.bottlerId) {
            bottleData.bottlerId = bottlerUpsert.id;
          }
        }
      }

      const distillerIds: number[] = [];
      const newDistillerIds: number[] = [];
      const currentDistillers = bottle.bottlesToDistillers.map(
        (d) => d.distiller,
      );

      // find newly added distillers and connect them
      if (body.distillers) {
        for (const distData of body.distillers) {
          const distiller = currentDistillers.find((d2) =>
            typeof distData === "number"
              ? distData === d2.id
              : distData.name === d2.name,
          );

          if (!distiller) {
            const distUpsert = await upsertEntity({
              db: tx,
              data: distData,
              userId: req.user.id,
              type: "distiller",
            });
            if (!distUpsert)
              throw new Error(`Unable to find entity: ${distData}`);

            await tx.insert(bottlesToDistillers).values({
              bottleId: bottle.id,
              distillerId: distUpsert.id,
            });

            distillerIds.push(distUpsert.id);
            newDistillerIds.push(distUpsert.id);
          } else {
            distillerIds.push(distiller.id);
          }
        }

        // find existing distillers which should no longer exist and remove them
        const removedDistillers = currentDistillers.filter((d) => {
          distillerIds.indexOf(d.id) === -1;
        });
        for (const distiller of removedDistillers) {
          await tx
            .delete(bottlesToDistillers)
            .where(
              and(
                eq(bottlesToDistillers.distillerId, distiller.id),
                eq(bottlesToDistillers.bottleId, bottle.id),
              ),
            );
        }
      }

      if (body.brand && typeof body.brand !== "number") {
        await tx.insert(changes).values({
          objectType: "entity",
          objectId: bottle.brandId,
          createdById: req.user.id,
          data: JSON.stringify(body.brand),
        });
      }

      await tx.insert(changes).values({
        objectType: "bottle",
        objectId: newBottle.id,
        createdById: req.user.id,
        data: JSON.stringify({
          ...bottleData,
          distillerIds: newDistillerIds,
        }),
      });

      return newBottle;
    });

    if (!newBottle) {
      return res.status(500).send({ error: "Failed to update bottle" });
    }

    res
      .status(200)
      .send(await serialize(BottleSerializer, newBottle, req.user));
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      bottleId: number;
    };
    Body: Partial<z.infer<typeof BottleInputSchema>>;
  }
>;
