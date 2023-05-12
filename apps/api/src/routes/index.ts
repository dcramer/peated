import { FastifyInstance, FastifyPluginCallback } from 'fastify'

import addBottle from './addBottle'
import addEntity from './addEntity'
import addTasting from './addTasting'
import authBasic from './authBasic'
import authDetails from './authDetails'
import authGoogle from './authGoogle'
import getBottle from './getBottle'
import getEntity from './getEntity'
import getTasting from './getTasting'
import getUser from './getUser'
import listBottles from './listBottles'
import listEntities from './listEntities'
import listTastings from './listTastings'
import listUsers from './listUsers'
import updateBottle from './updateBottle'
import updateTastingImage from './updateTastingImage'
import updateUser from './updateUser'
import updateUserAvatar from './updateUserAvatar'
import getUpload from './uploads'

export const router: FastifyPluginCallback = (
  fastify: FastifyInstance,
  _opts,
  next,
) => {
  fastify.decorateRequest('user', null)

  fastify.addHook('onRequest', (req, res, next) => {
    req.user = null
    next()
  })

  fastify.route({
    method: 'GET',
    url: '/health',
    handler: (_, res) => {
      res.status(200).send()
    },
  })

  fastify.route(authDetails)
  fastify.route(authBasic)
  fastify.route(authGoogle)

  fastify.route(listBottles)
  fastify.route(addBottle)
  fastify.route(getBottle)
  fastify.route(updateBottle)

  fastify.route(listEntities)
  fastify.route(addEntity)
  fastify.route(getEntity)

  fastify.route(listTastings)
  fastify.route(addTasting)
  fastify.route(getTasting)
  fastify.route(updateTastingImage)

  fastify.route(listUsers)
  fastify.route(getUser)
  fastify.route(updateUser)
  fastify.route(updateUserAvatar)

  fastify.route(getUpload)

  next()
}
