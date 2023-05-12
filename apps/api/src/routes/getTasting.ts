import { eq } from 'drizzle-orm'
import type { RouteOptions } from 'fastify'
import { IncomingMessage, Server, ServerResponse } from 'http'
import { db } from '../db'
import {
  bottles,
  bottlesToDistillers,
  editions,
  entities,
  tastings,
  users,
} from '../db/schema'
import { serializeTasting } from '../lib/transformers/tasting'

export default {
  method: 'GET',
  url: '/tastings/:tastingId',
  schema: {
    params: {
      type: 'object',
      required: ['tastingId'],
      properties: {
        tastingId: { type: 'number' },
      },
    },
  },
  handler: async (req, res) => {
    const [{ tasting, bottle, brand, createdBy, edition }] = await db
      .select({
        tasting: tastings,
        bottle: bottles,
        brand: entities,
        createdBy: users,
        edition: editions,
      })
      .from(tastings)
      .innerJoin(bottles, eq(tastings.bottleId, bottles.id))
      .innerJoin(entities, eq(entities.id, bottles.brandId))
      .innerJoin(users, eq(tastings.createdById, users.id))
      .leftJoin(editions, eq(tastings.editionId, editions.id))
      .where(eq(tastings.id, req.params.tastingId))
      .limit(1)

    if (!tasting) {
      return res.status(404).send({ error: 'Not found' })
    }

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

    res.send(
      serializeTasting(
        {
          ...tasting,
          createdBy,
          edition,
          bottle: {
            ...bottle,
            brand,
            distillers: distillersQuery.map(({ distiller }) => distiller),
          },
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
    Params: {
      tastingId: number
    }
  }
>
