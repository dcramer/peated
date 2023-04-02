import { FastifyInstance, FastifyPluginCallback } from "fastify";
import { RouteOptions } from "fastify";

import { listBottles, getBottle } from "./bottles";
import { googleCallback } from "./auth";

type RouteConfig = Record<string, RouteOptions>;

const routes: RouteConfig = {
  healthCheck: {
    method: "GET",
    url: "/health",
    handler: (_, res) => {
      res.status(200).send();
    },
  },
  authGoogle: {
    method: "GET",
    url: "/auth/google/callback",
    handler: googleCallback,
  },
  listBottles: {
    method: "GET",
    url: "/bottles",
    handler: listBottles,
  },
  getBottle: {
    method: "GET",
    url: "/bottles/:bottleId",
    handler: getBottle,
  },
};

export const router: FastifyPluginCallback = (
  fastify: FastifyInstance,
  opts,
  next
) => {
  fastify.decorateRequest("user", null);

  fastify.addHook("onRequest", (req, res, next) => {
    console.log("onRequest");
    req.user = null;
    next();
  });

  for (let route of Object.values(routes)) {
    fastify.route(route);
  }
  next();
};
