import type { FastifyInstance, FastifyPluginCallback } from "fastify";

import config from "~/config";
import addBadge from "./addBadge";
import addBottle from "./addBottle";
import addCollectionBottle from "./addCollectionBottle";
import addEntity from "./addEntity";
import addFlight from "./addFlight";
import { default as addFriend } from "./addFriend";
import addStore from "./addStore";
import addStorePrices from "./addStorePrices";
import addTasting from "./addTasting";
import addTastingComment from "./addTastingComment";
import addTastingToast from "./addTastingToast";
import authBasic from "./authBasic";
import authDetails from "./authDetails";
import authGoogle from "./authGoogle";
import countNotifications from "./countNotifications";
import previewCommentEmail from "./debug/previewCommentEmail";
import triggerSentry from "./debug/triggerSentry";
import deleteBottle from "./deleteBottle";
import deleteCollectionBottle from "./deleteCollectionBottle";
import deleteComment from "./deleteComment";
import deleteFriend from "./deleteFriend";
import deleteNotification from "./deleteNotification";
import deleteTasting from "./deleteTasting";
import deleteTastingImage from "./deleteTastingImage";
import getBottle from "./getBottle";
import getBottlePriceHistory from "./getBottlePriceHistory";
import getEntity from "./getEntity";
import getFlight from "./getFlight";
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
import listFlights from "./listFlights";
import listFriends from "./listFriends";
import listNotifications from "./listNotifications";
import listPriceChanges from "./listPriceChanges";
import listStorePrices from "./listStorePrices";
import listStores from "./listStores";
import listTastings from "./listTastings";
import listUserCollectionBottles from "./listUserCollectionBottles";
import listUserCollections from "./listUserCollections";
import listUserTags from "./listUserTags";
import listUsers from "./listUsers";
import mergeEntity from "./mergeEntity";
import root from "./root";
import updateBottle from "./updateBottle";
import updateEntity from "./updateEntity";
import updateNotification from "./updateNotification";
import updateTastingImage from "./updateTastingImage";
import updateUser from "./updateUser";
import updateUserAvatar from "./updateUserAvatar";
import getUpload from "./uploads";

const ROBOTS = `User-agent: *
Disallow: /`;

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
    url: "/_health",
    handler: (_, res) => {
      res.status(200).send();
    },
  });

  fastify.route({
    method: "GET",
    url: "/robots.txt",
    handler: (_, res) => {
      res.status(200).type("text/plain").send(ROBOTS);
    },
  });

  fastify.route(root);

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
  fastify.route(getBottlePriceHistory);

  fastify.route(listEntities);
  fastify.route(addEntity);
  fastify.route(getEntity);
  fastify.route(updateEntity);
  fastify.route(mergeEntity);

  fastify.route(listEntityCategories);

  fastify.route(listChanges);

  fastify.route(countNotifications);
  fastify.route(listNotifications);
  fastify.route(deleteNotification);
  fastify.route(updateNotification);

  fastify.route(listTastings);
  fastify.route(addTasting);
  fastify.route(getTasting);
  fastify.route(deleteTasting);
  fastify.route(updateTastingImage);
  fastify.route(deleteTastingImage);
  fastify.route(addTastingToast);
  fastify.route(addTastingComment);

  fastify.route(listFriends);
  fastify.route(addFriend);
  fastify.route(deleteFriend);

  fastify.route(listUsers);
  fastify.route(getUser);
  fastify.route(updateUser);
  fastify.route(updateUserAvatar);

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

  fastify.route(listPriceChanges);

  fastify.route(listBadges);
  fastify.route(addBadge);

  fastify.route(listFlights);
  fastify.route(addFlight);
  fastify.route(getFlight);

  if (config.ENV === "development") {
    registerDebugRoutes(fastify);
  }

  next();
};

function registerDebugRoutes(fastify: FastifyInstance) {
  fastify.route(triggerSentry);
  fastify.route(previewCommentEmail);
}
