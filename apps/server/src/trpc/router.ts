import { router } from ".";
import auth from "./routes/auth";
import authBasic from "./routes/authBasic";
import authGoogle from "./routes/authGoogle";
import badgeCreate from "./routes/badgeCreate";
import badgeList from "./routes/badgeList";
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
import collectionBottleList from "./routes/collectionBottleList";
import collectionList from "./routes/collectionList";
import commentCreate from "./routes/commentCreate";
import commentList from "./routes/commentList";
import entityById from "./routes/entityById";
import entityCategoryList from "./routes/entityCategoryList";
import entityCreate from "./routes/entityCreate";
import entityList from "./routes/entityList";
import entityMerge from "./routes/entityMerge";
import entityUpdate from "./routes/entityUpdate";
import flightById from "./routes/flightById";
import flightCreate from "./routes/flightCreate";
import flightList from "./routes/flightList";
import friendCreate from "./routes/friendCreate";
import friendList from "./routes/friendList";
import notificationCount from "./routes/notificationCount";
import notificationList from "./routes/notificationList";
import priceChangeList from "./routes/priceChangeList";
import stats from "./routes/stats";
import storeById from "./routes/storeById";
import storeCreate from "./routes/storeCreate";
import storeList from "./routes/storeList";
import storePriceCreateBatch from "./routes/storePriceCreateBatch";
import storePriceList from "./routes/storePriceList";
import tastingById from "./routes/tastingById";
import tastingCreate from "./routes/tastingCreate";
import tastingList from "./routes/tastingList";
import toastCreate from "./routes/toastCreate";
import userById from "./routes/userById";
import userList from "./routes/userList";
import userTagList from "./routes/userTagList";
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
  bottlePriceHistory,
  bottleSuggestedTagList,
  bottleTagList,
  bottlePriceList,
  bottleUpdate,
  changeList,
  collectionBottleCreate,
  collectionBottleList,
  collectionList,
  commentCreate,
  commentList,
  entityById,
  entityCategoryList,
  entityCreate,
  entityList,
  entityMerge,
  entityUpdate,
  flightById,
  flightCreate,
  flightList,
  friendCreate,
  friendList,
  notificationCount,
  notificationList,
  priceChangeList,
  stats,
  storeById,
  storeCreate,
  storeList,
  storePriceList,
  storePriceCreateBatch,
  tastingById,
  tastingCreate,
  tastingList,
  toastCreate,
  userById,
  userList,
  userTagList,
  version,
});

export type AppRouter = typeof appRouter;
