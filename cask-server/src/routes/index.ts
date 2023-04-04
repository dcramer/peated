import { FastifyInstance, FastifyPluginCallback } from "fastify";

import { listBottles, getBottle, addBottle } from "./bottles";
import { authGoogle } from "./auth";

export const router: FastifyPluginCallback = (
  fastify: FastifyInstance,
  opts,
  next
) => {
  fastify.decorateRequest("user", null);

  fastify.addHook("onRequest", (req, res, next) => {
    req.user = null;
    next();
  });

  fastify.route({
    method: "GET",
    url: "/health",
    handler: (_, res) => {
      res.status(200).send();
    },
  });

  fastify.route(authGoogle);

  fastify.route(listBottles);
  fastify.route(addBottle);
  fastify.route(getBottle);

  next();
};
