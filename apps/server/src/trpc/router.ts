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
import bottlePricesList from "./routes/bottlePricesList";
import entityById from "./routes/entityById";
import entityCreate from "./routes/entityCreate";
import flightById from "./routes/flightById";
import flightCreate from "./routes/flightCreate";
import friendCreate from "./routes/friendCreate";
import notificationCount from "./routes/notificationCount";
import stats from "./routes/stats";
import storeById from "./routes/storeById";
import storeCreate from "./routes/storeCreate";
import storePricesCreate from "./routes/storePricesCreate";
import tastingById from "./routes/tastingById";
import tastingCommentCreate from "./routes/tastingCommentCreate";
import tastingCreate from "./routes/tastingCreate";
import tastingToastCreate from "./routes/tastingToastCreate";
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
  bottlePricesList,
  entityById,
  entityCreate,
  flightById,
  flightCreate,
  friendCreate,
  notificationCount,
  stats,
  storeById,
  storeCreate,
  storePricesCreate,
  tastingById,
  tastingCommentCreate,
  tastingCreate,
  tastingToastCreate,
  userById,
});

export type AppRouter = typeof appRouter;
