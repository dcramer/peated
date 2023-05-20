import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { TastingInputSchema, TastingSchema } from "@peated/shared/schemas";

import { db } from "../db";
import {
  NewTasting,
  Tasting,
  bottles,
  bottlesToDistillers,
  changes,
  editions,
  entities,
  tastings,
} from "../db/schema";
import { isDistantFuture, isDistantPast } from "../lib/dates";
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

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, body.bottle));
    if (!bottle) {
      return res.status(400).send({ error: "Could not identify bottle" });
    }

    const data: NewTasting = {
      bottleId: bottle.id,
      notes: body.notes || null,
      rating: body.rating || null,
      tags: body.tags ? body.tags.map((t) => t.toLowerCase()) : [],
      createdById: req.user.id,
    };
    if (body.createdAt) {
      data.createdAt = new Date(body.createdAt);
      if (isDistantFuture(data.createdAt, 60 * 5)) {
        return res.status(400).send({ error: "createdAt too far in future" });
      }
      if (isDistantPast(data.createdAt, 60 * 60 * 24 * 7)) {
        return res.status(400).send({ error: "createdAt too far in past" });
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

      let tasting: Tasting | undefined;
      try {
        [tasting] = await tx
          .insert(tastings)
          .values({
            ...data,
            editionId: await getEditionId(),
          })
          .returning();
      } catch (err: any) {
        if (err?.code === "23505" && err?.constraint === "tasting_unq") {
          res.status(409).send({ error: "Tasting already exists" });
          return;
        }
        throw err;
      }
      if (!tasting) return;

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

    if (!tasting) {
      return res.status(500).send({ error: "Unable to create tasting" });
    }
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
