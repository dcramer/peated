import { eq, inArray, sql } from 'drizzle-orm'
import type { RouteOptions } from 'fastify'
import { IncomingMessage, Server, ServerResponse } from 'http'
import { db } from '../db'
import {
  NewTasting,
  bottles,
  bottlesToDistillers,
  changes,
  editions,
  entities,
  tastings,
  users,
} from '../db/schema'
import { serializeTasting } from '../lib/transformers/tasting'
import { validateRequest } from '../middleware/auth'

export default {
  method: 'POST',
  url: '/tastings',
  schema: {
    body: {
      type: 'object',
      required: ['bottle', 'rating'],
      properties: {
        bottle: { type: 'number' },
        rating: { type: 'number', minimum: 0, maximum: 5 },
        tastingNotes: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        edition: { type: 'string' },
        barrel: { type: 'number' },
      },
    },
  },
  preHandler: [validateRequest],
  handler: async (req, res) => {
    const body = req.body
    const user = req.user

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, body.bottle))
    if (!bottle) {
      return res.status(400).send({ error: 'Could not identify bottle' })
    }

    const tasting = await db.transaction(async (tx) => {
      const getEditionId = async (): Promise<number | undefined> => {
        if (!body.edition) return

        let [edition] = await tx
          .select()
          .from(editions)
          .where(eq(editions.name, body.edition))
        if (edition) return edition.id

        let [newEdition] = await tx
          .insert(editions)
          .values({
            bottleId: bottle.id,
            name: body.edition,
            barrel: body.barrel,
            createdById: req.user.id,
          })
          .onConflictDoNothing()
          .returning()

        // race for conflicts
        if (newEdition) {
          await tx.insert(changes).values({
            objectType: 'edition',
            objectId: newEdition.id,
            createdById: req.user.id,
            data: JSON.stringify({
              bottleId: bottle.id,
              name: body.edition,
              barrel: body.barrel,
            }),
          })
          return newEdition?.id
        }
        return (
          await tx
            .select()
            .from(editions)
            .where(eq(editions.name, body.edition))
        )[0].id
      }

      const [tasting] = await tx
        .insert(tastings)
        .values({
          comments: body.comments || null,
          rating: body.rating,
          tags: body.tags ? body.tags.map((t) => t.toLowerCase()) : [],
          bottleId: bottle.id,
          editionId: await getEditionId(),
          createdById: user.id,
        })
        .returning()

      await tx
        .update(bottles)
        .set({ totalTastings: sql`${bottles.totalTastings} + 1` })
        .where(eq(bottles.id, bottle.id))

      const distillerIds = (
        await db
          .select({ id: bottlesToDistillers.distillerId })
          .from(bottlesToDistillers)
          .where(eq(bottlesToDistillers.bottleId, bottle.id))
      ).map((d) => d.id)

      await tx
        .update(entities)
        .set({ totalTastings: sql`${entities.totalTastings} + 1` })
        .where(
          inArray(
            entities.id,
            Array.from(new Set([bottle.brandId, ...distillerIds])),
          ),
        )

      return tasting
    })

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
      .limit(1)

    const distillersQuery = await db
      .select({
        distiller: entities,
      })
      .from(entities)
      .innerJoin(
        bottlesToDistillers,
        eq(bottlesToDistillers.distillerId, entities.id),
      )
      .where(eq(bottlesToDistillers.bottleId, bottle.id))

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
    )
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Body: NewTasting & {
      bottle: number
      edition?: string
      barrel?: number
    }
  }
>
