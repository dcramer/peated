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
import bottlePricesList from "./routes/bottlePricesList";
import bottleSuggestedTagsList from "./routes/bottleSuggestedTagsList";
import bottleTagsList from "./routes/bottleTagsList";
import changeList from "./routes/changeList";
import commentCreate from "./routes/commentCreate";
import entityById from "./routes/entityById";
import entityCreate from "./routes/entityCreate";
import entityList from "./routes/entityList";
import flightById from "./routes/flightById";
import flightCreate from "./routes/flightCreate";
import flightList from "./routes/flightList";
import friendCreate from "./routes/friendCreate";
import notificationCount from "./routes/notificationCount";
import stats from "./routes/stats";
import storeById from "./routes/storeById";
import storeCreate from "./routes/storeCreate";
import storePricesCreate from "./routes/storePricesCreate";
import tastingById from "./routes/tastingById";
import tastingCreate from "./routes/tastingCreate";
import toastCreate from "./routes/toastCreate";
import userById from "./routes/userById";

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
  bottleSuggestedTagsList,
  bottleTagsList,
  bottlePricesList,
  changeList,
  entityById,
  entityCreate,
  entityList,
  flightById,
  flightCreate,
  flightList,
  friendCreate,
  notificationCount,
  stats,
  storeById,
  storeCreate,
  storePricesCreate,
  tastingById,
  commentCreate,
  tastingCreate,
  toastCreate,
  userById,
});

export type AppRouter = typeof appRouter;
