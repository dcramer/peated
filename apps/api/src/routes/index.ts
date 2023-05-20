import { FastifyInstance, FastifyPluginCallback } from "fastify";

import addBottle from "./addBottle";
import addCollectionBottle from "./addCollectionBottle";
import addEntity from "./addEntity";
import addTasting from "./addTasting";
import addTastingComment from "./addTastingComment";
import addTastingToast from "./addTastingToast";
import addUserFollow from "./addUserFollow";
import authBasic from "./authBasic";
import authDetails from "./authDetails";
import authGoogle from "./authGoogle";
import deleteCollectionBottle from "./deleteCollectionBottle";
import deleteComment from "./deleteComment";
import deleteNotification from "./deleteNotification";
import deleteTasting from "./deleteTasting";
import deleteUserFollow from "./deleteUserFollow";
import getBottle from "./getBottle";
import getEntity from "./getEntity";
import getTasting from "./getTasting";
import getUser from "./getUser";
import listBottleEditions from "./listBottleEditions";
import listBottleSuggestedTags from "./listBottleSuggestedTags";
import listBottles from "./listBottles";
import listCollections from "./listCollections";
import listComments from "./listComments";
import listEntities from "./listEntities";
import listFollowers from "./listFollowers";
import listFollowing from "./listFollowing";
import listNotifications from "./listNotifications";
import listTastings from "./listTastings";
import listUsers from "./listUsers";
import updateBottle from "./updateBottle";
import updateEntity from "./updateEntity";
import updateFollower from "./updateFollower";
import updateTastingImage from "./updateTastingImage";
import updateUser from "./updateUser";
import updateUserAvatar from "./updateUserAvatar";
import getUpload from "./uploads";

export const router: FastifyPluginCallback = (
  fastify: FastifyInstance,
  _opts,
  next,
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

  fastify.route(listBottleSuggestedTags);

  fastify.route(listBottleEditions);

  fastify.route(listEntities);
  fastify.route(addEntity);
  fastify.route(getEntity);
  fastify.route(updateEntity);

  fastify.route(listNotifications);
  fastify.route(deleteNotification);

  fastify.route(listTastings);
  fastify.route(addTasting);
  fastify.route(getTasting);
  fastify.route(deleteTasting);
  fastify.route(updateTastingImage);
  fastify.route(addTastingToast);
  fastify.route(addTastingComment);

  fastify.route(listFollowers);
  fastify.route(updateFollower);
  fastify.route(listFollowing);

  fastify.route(listUsers);
  fastify.route(getUser);
  fastify.route(updateUser);
  fastify.route(updateUserAvatar);
  fastify.route(addUserFollow);
  fastify.route(deleteUserFollow);

  fastify.route(listCollections);
  fastify.route(addCollectionBottle);
  fastify.route(deleteCollectionBottle);

  fastify.route(listComments);
  fastify.route(deleteComment);

  fastify.route(getUpload);

  next();
};
