import { and, eq } from "drizzle-orm";
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
import { serialize } from "../lib/serializers";
import { BottleSerializer } from "../lib/serializers/bottle";
import { requireMod } from "../middleware/auth";

type BottleInput = {
  name: string;
  category?: Category | null;
  brand: EntityInput;
  distillers: EntityInput[];
  statedAge?: number | null;
};

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
    body: {
      $ref: "/schemas/updateBottle",
    },
    response: {
      200: {
        $ref: "/schemas/bottle",
      },
    },
  },
  preHandler: [requireMod],
  handler: async (req, res) => {
    const [{ bottle, brand }] = await db
      .select({
        bottle: bottles,
        brand: entities,
      })
      .from(bottles)
      .innerJoin(entities, eq(entities.id, bottles.brandId))
      .where(eq(bottles.id, req.params.bottleId));

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

    const currentDistillers = (
      await db
        .select({
          distiller: entities,
        })
        .from(entities)
        .innerJoin(
          bottlesToDistillers,
          eq(bottlesToDistillers.distillerId, entities.id),
        )
        .where(eq(bottlesToDistillers.bottleId, bottle.id))
    ).map(({ distiller }) => distiller);
    const newBottle = await db.transaction(async (tx) => {
      const newBottle = Object.values(bottleData).length
        ? (
            await tx
              .update(bottles)
              .set(bottleData)
              .where(eq(bottles.id, bottle.id))
              .returning()
          )[0]
        : bottle;

      if (body.brand) {
        if (
          typeof body.brand === "number"
            ? body.brand !== bottle.brandId
            : body.brand.name !== brand.name
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

      const distillerIds: number[] = [];
      const newDistillerIds: number[] = [];

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
    Body: Partial<BottleInput>;
  }
>;
