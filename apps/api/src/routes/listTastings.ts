import { SQL, and, desc, eq, inArray } from 'drizzle-orm'
import type { RouteOptions } from 'fastify'
import { IncomingMessage, Server, ServerResponse } from 'http'
import { db } from '../db'
import {
  Entity,
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
  url: '/tastings',
  schema: {
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'number' },
        bottle: { type: 'number' },
        user: { type: 'number' },
        filter: { type: 'string', enum: ['global', 'friends', 'local'] },
      },
    },
  },
  handler: async (req, res) => {
    const page = req.query.page || 1

    const limit = 100
    const offset = (page - 1) * limit

    const where: SQL<unknown>[] = []
    if (req.query.bottle) {
      where.push(eq(tastings.bottleId, req.query.bottle))
    }
    if (req.query.user) {
      where.push(eq(tastings.createdById, req.query.user))
    }

    const results = await db
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
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(desc(tastings.createdAt))

    const distillers = results.length
      ? await db
          .select({
            bottleId: bottlesToDistillers.bottleId,
            distiller: entities,
          })
          .from(entities)
          .innerJoin(
            bottlesToDistillers,
            eq(bottlesToDistillers.distillerId, entities.id),
          )
          .where(
            inArray(
              bottlesToDistillers.bottleId,
              results.map(({ bottle: b }) => b.id),
            ),
          )
      : []

    const distillersByBottleId: {
      [bottleId: number]: Entity[]
    } = {}
    distillers.forEach((d) => {
      if (!distillersByBottleId[d.bottleId])
        distillersByBottleId[d.bottleId] = [d.distiller]
      else distillersByBottleId[d.bottleId].push(d.distiller)
    })

    res.send(
      results.map(({ tasting, bottle, brand, createdBy, edition }) =>
        serializeTasting(
          {
            ...tasting,
            createdBy,
            edition,
            bottle: {
              ...bottle,
              brand,
              distillers: distillersByBottleId[bottle.id],
            },
          },
          req.user,
        ),
      ),
    )
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Querystring: {
      page?: number
      bottle?: number
      user?: number
    }
  }
>
