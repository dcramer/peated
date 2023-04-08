import { FastifyInstance, FastifyPluginCallback } from "fastify";

import { listBottles, getBottle, addBottle } from "./bottles";
import { authGoogle } from "./auth";
import { addCheckin, getCheckin, listCheckins } from "./checkins";
import { getBrand, listBrands } from "./brands";
import { getDistiller, listDistillers } from "./distillers";

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

  fastify.route(listBrands);
  fastify.route(getBrand);

  fastify.route(addCheckin);
  fastify.route(listCheckins);
  fastify.route(getCheckin);

  fastify.route(listDistillers);
  fastify.route(getDistiller);

  next();
};
