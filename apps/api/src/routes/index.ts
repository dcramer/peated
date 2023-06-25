import type { FastifyInstance, FastifyPluginCallback } from "fastify";

import addBottle from "./addBottle";
import addCollectionBottle from "./addCollectionBottle";
import addEntity from "./addEntity";
import addStore from "./addStore";
import addStorePrices from "./addStorePrices";
import addTasting from "./addTasting";
import addTastingComment from "./addTastingComment";
import addTastingToast from "./addTastingToast";
import addUserFollow from "./addUserFollow";
import authBasic from "./authBasic";
import authDetails from "./authDetails";
import authGoogle from "./authGoogle";
import deleteBottle from "./deleteBottle";
import deleteCollectionBottle from "./deleteCollectionBottle";
import deleteComment from "./deleteComment";
import deleteNotification from "./deleteNotification";
import deleteTasting from "./deleteTasting";
import deleteTastingImage from "./deleteTastingImage";
import deleteUserFollow from "./deleteUserFollow";
import getBottle from "./getBottle";
import getEntity from "./getEntity";
import getStats from "./getStats";
import getStore from "./getStore";
import getTasting from "./getTasting";
import getUser from "./getUser";
import listBadges from "./listBadges";
import listBottlePrices from "./listBottlePrices";
import listBottleSuggestedTags from "./listBottleSuggestedTags";
import listBottleTags from "./listBottleTags";
import listBottles from "./listBottles";
import listChanges from "./listChanges";
import listComments from "./listComments";
import listEntities from "./listEntities";
import listEntityCategories from "./listEntityCategories";
import listFollowers from "./listFollowers";
import listFollowing from "./listFollowing";
import listNotifications from "./listNotifications";
import listStorePrices from "./listStorePrices";
import listStores from "./listStores";
import listTastings from "./listTastings";
import listUserCollectionBottles from "./listUserCollectionBottles";
import listUserCollections from "./listUserCollections";
import listUserTags from "./listUserTags";
import listUsers from "./listUsers";
import triggerSentry from "./triggerSentry";
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

  fastify.route(getStats);

  fastify.route(authDetails);
  fastify.route(authBasic);
  fastify.route(authGoogle);

  fastify.route(listBottles);
  fastify.route(addBottle);
  fastify.route(getBottle);
  fastify.route(updateBottle);
  fastify.route(deleteBottle);

  fastify.route(listBottleTags);
  fastify.route(listBottleSuggestedTags);

  fastify.route(listBottlePrices);

  fastify.route(listEntities);
  fastify.route(addEntity);
  fastify.route(getEntity);
  fastify.route(updateEntity);

  fastify.route(listEntityCategories);

  fastify.route(listChanges);

  fastify.route(listNotifications);
  fastify.route(deleteNotification);

  fastify.route(listTastings);
  fastify.route(addTasting);
  fastify.route(getTasting);
  fastify.route(deleteTasting);
  fastify.route(updateTastingImage);
  fastify.route(deleteTastingImage);
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

  fastify.route(listUserCollectionBottles);
  fastify.route(listUserTags);

  fastify.route(listUserCollections);
  fastify.route(addCollectionBottle);
  fastify.route(deleteCollectionBottle);

  fastify.route(listComments);
  fastify.route(deleteComment);

  fastify.route(getUpload);

  fastify.route(listStores);
  fastify.route(getStore);
  fastify.route(addStore);

  fastify.route(listStorePrices);
  fastify.route(addStorePrices);

  fastify.route(listBadges);

  fastify.route(triggerSentry);

  next();
};
