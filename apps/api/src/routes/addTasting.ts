import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import {
  NewTasting,
  bottles,
  bottlesToDistillers,
  changes,
  editions,
  entities,
  tastings,
  users,
} from "../db/schema";
import { serializeTasting } from "../lib/serializers/tasting";
import { requireAuth } from "../middleware/auth";

export default {
  method: "POST",
  url: "/tastings",
  schema: {
    body: {
      type: "object",
      required: ["bottle", "rating"],
      properties: {
        bottle: { type: "number" },
        rating: { type: "number", minimum: 0, maximum: 5 },
        notes: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        edition: { type: "string" },
        vintageYear: { type: "number" },
        barrel: { type: "number" },
      },
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

    const [{ brand, createdBy, edition }] = await db
      .select({
        brand: entities,
        createdBy: users,
        edition: editions,
      })
      .from(tastings)
      .innerJoin(bottles, eq(tastings.bottleId, bottles.id))
      .innerJoin(entities, eq(entities.id, bottles.brandId))
      .innerJoin(users, eq(tastings.createdById, users.id))
      .leftJoin(editions, eq(tastings.editionId, editions.id))
      .where(eq(tastings.id, tasting.id))
      .limit(1);

    const distillersQuery = await db
      .select({
        distiller: entities,
      })
      .from(entities)
      .innerJoin(
        bottlesToDistillers,
        eq(bottlesToDistillers.distillerId, entities.id),
      )
      .where(eq(bottlesToDistillers.bottleId, bottle.id));

    res.status(201).send(
      serializeTasting(
        {
          ...tasting,
          bottle: {
            ...bottle,
            brand,
            distillers: distillersQuery.map(({ distiller }) => distiller),
          },
          edition,
          createdBy,
        },
        req.user,
      ),
    );
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Body: NewTasting & {
      bottle: number;
      edition?: string;
      barrel?: number;
      vintageYear?: number;
    };
  }
>;
