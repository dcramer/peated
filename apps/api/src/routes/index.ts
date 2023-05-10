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
import getUpload from "./uploads";
import listTastings from "./listTastings";
import addTasting from "./addTasting";
import getTasting from "./getTasting";
import updateUser from "./updateUser";
import updateUserAvatar from "./updateUserAvatar";
import updateTastingImage from "./updateTastingImage";
import updateBottle from "./updateBottle";

export const router: FastifyPluginCallback = (
  fastify: FastifyInstance,
  _opts,
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
  fastify.route(updateBottle);

  fastify.route(listEntities);
  fastify.route(addEntity);
  fastify.route(getEntity);

  fastify.route(listTastings);
  fastify.route(addTasting);
  fastify.route(getTasting);
  fastify.route(updateTastingImage);

  fastify.route(listUsers);
  fastify.route(getUser);
  fastify.route(updateUser);
  fastify.route(updateUserAvatar);

  fastify.route(getUpload);

  next();
};
