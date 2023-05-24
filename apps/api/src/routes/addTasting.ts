import { eq, inArray, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { TastingInputSchema, TastingSchema } from "@peated/shared/schemas";

import { db } from "../db";
import {
  NewTasting,
  Tasting,
  bottleTags,
  bottles,
  bottlesToDistillers,
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
      tags: body.tags
        ? Array.from(new Set(body.tags.map((t) => t.toLowerCase())))
        : [],
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

    const tasting = await db.transaction(async (tx) => {
      let tasting: Tasting | undefined;
      try {
        [tasting] = await tx
          .insert(tastings)
          .values({
            ...data,
            series: body.series,
            vintageYear: body.vintageYear,
            barrel: body.barrel,
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

      for (const tag of tasting.tags) {
        await tx
          .insert(bottleTags)
          .values({
            bottleId: bottle.id,
            tag,
            count: 1,
          })
          .onConflictDoUpdate({
            target: [bottleTags.bottleId, bottleTags.tag],
            set: {
              count: sql<number>`${bottleTags.count} + 1`,
            },
          });
      }

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
