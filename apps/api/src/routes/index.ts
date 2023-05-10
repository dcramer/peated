import { FastifyInstance, FastifyPluginCallback } from "fastify";

import authDetails from "./authDetails";
import authBasic from "./authBasic";
import authGoogle from "./authGoogle";
import listBottles from "./listBottles";
import addBottle from "./addBottle";
import getBottle from "./getBottle";
import listEntities from "./listEntities";
import addEntity from "./addEntity";
import getEntity from "./getEntity";
import listUsers from "./listUsers";
import getUser from "./getUser";
import { getUpload } from "./uploads";

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

  fastify.route(authDetails);
  fastify.route(authBasic);
  fastify.route(authGoogle);

  fastify.route(listBottles);
  fastify.route(addBottle);
  fastify.route(getBottle);

  fastify.route(listEntities);
  fastify.route(addEntity);
  fastify.route(getEntity);

  // fastify.route(addCheckin);
  // fastify.route(listCheckins);
  // fastify.route(getCheckin);
  // fastify.route(updateCheckinImage);

  fastify.route(listUsers);
  fastify.route(getUser);
  // fastify.route(updateUser);
  // fastify.route(updateUserAvatar);

  fastify.route(getUpload);

  next();
};
