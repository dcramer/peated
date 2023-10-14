import { and, eq, inArray, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import type { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { BottleInputSchema, BottleSchema } from "@peated/shared/schemas";

import { db } from "@peated/shared/db";
import type { Bottle, Entity } from "@peated/shared/db/schema";
import {
  bottles,
  bottlesToDistillers,
  changes,
  entities,
} from "@peated/shared/db/schema";
import { upsertEntity } from "../lib/db";
import { notEmpty } from "../lib/filter";
import { serialize } from "../lib/serializers";
import { BottleSerializer } from "../lib/serializers/bottle";
import { requireMod } from "../middleware/auth";

import pushJob from "@peated/shared/jobs";
import { normalizeBottleName } from "@peated/shared/lib/normalize";
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
    if (!req.user) return res.status(401);

    const bottle = await db.query.bottles.findFirst({
      where: (bottles, { eq }) => eq(bottles.id, req.params.bottleId),
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

    if (body.statedAge !== undefined && body.statedAge !== bottle.statedAge) {
      bottleData.statedAge = body.statedAge;
    }
    if (
      (body.name && body.name !== bottle.name) ||
      (body.statedAge !== undefined && body.statedAge !== bottle.statedAge)
    ) {
      bottleData.statedAge = bottleData.statedAge ?? bottle.statedAge;
      bottleData.name = normalizeBottleName(
        body.name || bottle.name,
        bottleData.statedAge,
      );
      if (
        bottleData.name.indexOf("-year-old") !== -1 &&
        !bottleData.statedAge
      ) {
        res
          .status(400)
          .send({ error: "You should include the Stated Age of the bottle" });
        return;
      }
    }

    if (body.category !== undefined && body.category !== bottle.category) {
      bottleData.category = body.category;
    }

    const user = req.user;
    const newBottle = await db.transaction(async (tx) => {
      let brand: Entity | null = null;
      if (body.brand) {
        if (
          typeof body.brand === "number"
            ? body.brand !== bottle.brand.id
            : body.brand.name !== bottle.brand.name
        ) {
          const brandUpsert = await upsertEntity({
            db: tx,
            data: body.brand,
            userId: user.id,
            type: "brand",
          });
          if (!brandUpsert)
            throw new Error(`Unable to find entity: ${body.brand}`);
          if (brandUpsert.id !== bottle.brandId) {
            bottleData.brandId = brandUpsert.id;
          }
          brand = brandUpsert.result;
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
            userId: user.id,
            type: "bottler",
          });
          if (!bottlerUpsert)
            throw new Error(`Unable to find entity: ${body.bottler}`);
          if (bottlerUpsert.id !== bottle.bottlerId) {
            bottleData.bottlerId = bottlerUpsert.id;
          }
        }
      }

      if (bottleData.name || bottleData.brandId) {
        if (!brand) {
          brand =
            (await db.query.entities.findFirst({
              where: eq(entities.id, bottle.brandId),
            })) || null;
          if (!brand) throw new Error("Unexpected");
        }
        bottleData.fullName = `${brand.name} ${bottleData.name ?? bottle.name}`;
      }

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

      if (!newBottle) return;

      const distillerIds: number[] = [];
      const newDistillerIds: number[] = [];
      const removedDistillerIds: number[] = [];
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
              userId: user.id,
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
          removedDistillerIds.push(distiller.id);
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

      if (!brand) {
        brand = (await tx.query.entities.findFirst({
          where: (entities, { eq }) =>
            eq(entities.id, (newBottle as Bottle).brandId),
        })) as Entity;
      }

      const newEntityIds = Array.from(
        new Set([
          bottleData?.brandId,
          ...newDistillerIds,
          bottleData?.bottlerId,
        ]),
      ).filter(notEmpty);
      if (newEntityIds.length) {
        await tx
          .update(entities)
          .set({ totalBottles: sql`${entities.totalBottles} + 1` })
          .where(inArray(entities.id, newEntityIds));
      }

      const removedEntityIds = Array.from(
        new Set([
          bottleData?.brandId ? bottle.brandId : undefined,
          ...removedDistillerIds,
          bottleData?.bottlerId ? bottle.bottlerId : undefined,
        ]),
      ).filter(notEmpty);
      if (removedEntityIds.length) {
        await tx
          .update(entities)
          .set({ totalBottles: sql`${entities.totalBottles} - 1` })
          .where(inArray(entities.id, removedEntityIds));
      }

      await tx.insert(changes).values({
        objectType: "bottle",
        objectId: newBottle.id,
        createdById: user.id,
        displayName: newBottle.fullName,
        type: "update",
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

    if (
      newBottle.fullName !== bottle.fullName ||
      !newBottle.description ||
      !newBottle.tastingNotes ||
      newBottle.suggestedTags.length === 0
    )
      await pushJob("GenerateBottleDetails", { bottleId: bottle.id });

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
