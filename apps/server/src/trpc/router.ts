import { createCallerFactory, router } from ".";

import auth from "./routes/auth";
import authBasic from "./routes/authBasic";
import authGoogle from "./routes/authGoogle";
import badgeCreate from "./routes/badgeCreate";
import badgeList from "./routes/badgeList";
import bottleAliasList from "./routes/bottleAliasList";
import bottleById from "./routes/bottleById";
import bottleCreate from "./routes/bottleCreate";
import bottleDelete from "./routes/bottleDelete";
import bottleList from "./routes/bottleList";
import bottlePriceHistory from "./routes/bottlePriceHistory";
import bottlePriceList from "./routes/bottlePriceList";
import bottleSuggestedTagList from "./routes/bottleSuggestedTagList";
import bottleTagList from "./routes/bottleTagList";
import bottleUpdate from "./routes/bottleUpdate";
import changeList from "./routes/changeList";
import collectionBottleCreate from "./routes/collectionBottleCreate";
import collectionBottleDelete from "./routes/collectionBottleDelete";
import collectionBottleList from "./routes/collectionBottleList";
import collectionList from "./routes/collectionList";
import commentCreate from "./routes/commentCreate";
import commentDelete from "./routes/commentDelete";
import commentList from "./routes/commentList";
import entityById from "./routes/entityById";
import entityCategoryList from "./routes/entityCategoryList";
import entityCreate from "./routes/entityCreate";
import entityList from "./routes/entityList";
import entityMerge from "./routes/entityMerge";
import entityUpdate from "./routes/entityUpdate";
import externalSiteByType from "./routes/externalSiteByType";
import externalSiteConfigGet from "./routes/externalSiteConfigGet";
import externalSiteConfigSet from "./routes/externalSiteConfigSet";
import externalSiteCreate from "./routes/externalSiteCreate";
import externalSiteList from "./routes/externalSiteList";
import externalSiteTriggerJob from "./routes/externalSiteTriggerJob";
import externalSiteUpdate from "./routes/externalSiteUpdate";
import flightById from "./routes/flightById";
import flightCreate from "./routes/flightCreate";
import flightList from "./routes/flightList";
import friendCreate from "./routes/friendCreate";
import friendDelete from "./routes/friendDelete";
import friendList from "./routes/friendList";
import notificationCount from "./routes/notificationCount";
import notificationDelete from "./routes/notificationDelete";
import notificationList from "./routes/notificationList";
import notificationUpdate from "./routes/notificationUpdate";
import priceChangeList from "./routes/priceChangeList";
import priceCreateBatch from "./routes/priceCreateBatch";
import priceList from "./routes/priceList";
import reviewCreate from "./routes/reviewCreate";
import reviewList from "./routes/reviewList";
import stats from "./routes/stats";
import tastingById from "./routes/tastingById";
import tastingCreate from "./routes/tastingCreate";
import tastingDelete from "./routes/tastingDelete";
import tastingImageDelete from "./routes/tastingImageDelete";
import tastingList from "./routes/tastingList";
import tastingUpdate from "./routes/tastingUpdate";
import toastCreate from "./routes/toastCreate";
import userById from "./routes/userById";
import userList from "./routes/userList";
import userTagList from "./routes/userTagList";
import userUpdate from "./routes/userUpdate";
import version from "./routes/version";

export const appRouter = router({
  auth,
  authBasic,
  authGoogle,
  badgeCreate,
  badgeList,
  bottleById,
  bottleDelete,
  bottleCreate,
  bottleList,
  bottleAliasList,
  bottlePriceHistory,
  bottleSuggestedTagList,
  bottleTagList,
  bottlePriceList,
  bottleUpdate,
  changeList,
  collectionBottleCreate,
  collectionBottleDelete,
  collectionBottleList,
  collectionList,
  commentCreate,
  commentDelete,
  commentList,
  entityById,
  entityCategoryList,
  entityCreate,
  entityList,
  entityMerge,
  entityUpdate,
  externalSiteCreate,
  externalSiteByType,
  externalSiteList,
  externalSiteTriggerJob,
  externalSiteUpdate,
  externalSiteConfigGet,
  externalSiteConfigSet,
  flightById,
  flightCreate,
  flightList,
  friendCreate,
  friendDelete,
  friendList,
  notificationCount,
  notificationDelete,
  notificationList,
  notificationUpdate,
  priceChangeList,
  reviewCreate,
  reviewList,
  stats,
  priceList,
  priceCreateBatch,
  tastingById,
  tastingCreate,
  tastingDelete,
  tastingList,
  tastingImageDelete,
  tastingUpdate,
  toastCreate,
  userById,
  userList,
  userTagList,
  userUpdate,
  version,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
