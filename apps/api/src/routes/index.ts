import { FastifyInstance, FastifyPluginCallback } from "fastify";

// import {
//   addCheckin,
//   getCheckin,
//   listCheckins,
//   updateCheckinImage,
// } from "./checkins";
// import { getUser, listUsers, updateUser, updateUserAvatar } from "./users";
// import { getUpload } from "./uploads";
import authDetails from "./authDetails";
import authBasic from "./authBasic";
import authGoogle from "./authGoogle";
import listBottles from "./listBottles";
import addBottle from "./addBottle";
import getBottle from "./getBottle";
import listEntities from "./listEntities";
import addEntity from "./addEntity";
import getEntity from "./getEntity";

const routes = [
  authDetails,
  authBasic,
  authGoogle,

  listBottles,
  addBottle,
  getBottle,

  listEntities,
  addEntity,
  ,
  getEntity,
];

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

  // fastify.route(addCheckin);
  // fastify.route(listCheckins);
  // fastify.route(getCheckin);
  // fastify.route(updateCheckinImage);

  // fastify.route(listUsers);
  // fastify.route(getUser);
  // fastify.route(updateUser);
  // fastify.route(updateUserAvatar);

  // fastify.route(getUpload);

  next();
};
