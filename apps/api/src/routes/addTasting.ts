import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { TastingInputSchema, TastingSchema } from "@peated/shared/schemas";

import { db } from "../db";
import {
  bottles,
  bottlesToDistillers,
  changes,
  editions,
  entities,
  tastings,
} from "../db/schema";
import { serialize } from "../lib/serializers";
import { TastingSerializer } from "../lib/serializers/tasting";
import { requireAuth } from "../middleware/auth";

export default {
  method: "POST",
  url: "/tastings",
  schema: {
    body: zodToJsonSchema(TastingInputSchema),
    response: {
      201: zodToJsonSchema(TastingSchema),
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    const body = req.body;
    const user = req.user;

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, body.bottle));
    if (!bottle) {
      return res.status(400).send({ error: "Could not identify bottle" });
    }

    if (body.vintageYear) {
      if (body.vintageYear > new Date().getFullYear()) {
        return res.status(400).send({ error: "Invalid vintageYear" });
      }
      if (body.vintageYear < 1495) {
        return res.status(400).send({ error: "Invalid vintageYear" });
      }
    }

    const hasEdition = body.edition || body.barrel || body.vintageYear;

    const tasting = await db.transaction(async (tx) => {
      const getEditionId = async (): Promise<number | undefined> => {
        if (!hasEdition) return;

        const lookupParams = [eq(editions.bottleId, bottle.id)];
        if (body.edition) {
          lookupParams.push(eq(editions.name, body.edition));
        } else {
          lookupParams.push(isNull(editions.name));
        }
        if (body.barrel) {
          lookupParams.push(eq(editions.barrel, body.barrel));
        } else {
          lookupParams.push(isNull(editions.barrel));
        }
        if (body.vintageYear) {
          lookupParams.push(eq(editions.vintageYear, body.vintageYear));
        } else {
          lookupParams.push(isNull(editions.vintageYear));
        }

        const [edition] = await tx
          .select()
          .from(editions)
          .where(and(...lookupParams));
        if (edition) return edition.id;

        const [newEdition] = await tx
          .insert(editions)
          .values({
            bottleId: bottle.id,
            name: body.edition || null,
            vintageYear: body.vintageYear || null,
            barrel: body.barrel || null,
            createdById: req.user.id,
          })
          .onConflictDoNothing()
          .returning();

        // race for conflicts
        if (newEdition) {
          await tx.insert(changes).values({
            objectType: "edition",
            objectId: newEdition.id,
            createdById: req.user.id,
            data: JSON.stringify({
              bottleId: bottle.id,
              name: body.edition,
              barrel: body.barrel,
              vintageYear: body.vintageYear,
            }),
          });
          return newEdition?.id;
        }
        return (
          await tx
            .select()
            .from(editions)
            .where(and(...lookupParams))
        )[0].id;
      };

      const [tasting] = await tx
        .insert(tastings)
        .values({
          notes: body.notes || null,
          rating: body.rating,
          tags: body.tags ? body.tags.map((t) => t.toLowerCase()) : [],
          bottleId: bottle.id,
          editionId: await getEditionId(),
          createdById: user.id,
        })
        .returning();

      await tx
        .update(bottles)
        .set({ totalTastings: sql`${bottles.totalTastings} + 1` })
        .where(eq(bottles.id, bottle.id));

      const distillerIds = (
        await db
          .select({ id: bottlesToDistillers.distillerId })
          .from(bottlesToDistillers)
          .where(eq(bottlesToDistillers.bottleId, bottle.id))
      ).map((d) => d.id);

      await tx
        .update(entities)
        .set({ totalTastings: sql`${entities.totalTastings} + 1` })
        .where(
          inArray(
            entities.id,
            Array.from(new Set([bottle.brandId, ...distillerIds])),
          ),
        );

      return tasting;
    });

    res.status(201).send(await serialize(TastingSerializer, tasting, req.user));
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Body: z.infer<typeof TastingInputSchema>;
  }
>;
