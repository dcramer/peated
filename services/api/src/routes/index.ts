import { FastifyInstance, FastifyPluginCallback } from "fastify";

import { listBottles, getBottle, addBottle } from "./bottles";
import { authBasic, authDetails, authGoogle } from "./auth";
import {
  addCheckin,
  getCheckin,
  listCheckins,
  updateCheckinImage,
} from "./checkins";
import { addBrand, getBrand, listBrands } from "./brands";
import { addDistiller, getDistiller, listDistillers } from "./distillers";
import { getUser, listUsers, updateUser, updateUserAvatar } from "./users";
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
  fastify.route(authGoogle);
  fastify.route(authBasic);

  fastify.route(listBottles);
  fastify.route(addBottle);
  fastify.route(getBottle);

  fastify.route(listBrands);
  fastify.route(getBrand);
  fastify.route(addBrand);

  fastify.route(addCheckin);
  fastify.route(listCheckins);
  fastify.route(getCheckin);
  fastify.route(updateCheckinImage);

  fastify.route(listDistillers);
  fastify.route(getDistiller);
  fastify.route(addDistiller);

  fastify.route(listUsers);
  fastify.route(getUser);
  fastify.route(updateUser);
  fastify.route(updateUserAvatar);

  fastify.route(getUpload);

  next();
};
