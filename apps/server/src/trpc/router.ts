import { createCallerFactory, router } from ".";
import type { Context } from "./context";

import auth from "./routes/auth";
import authBasic from "./routes/authBasic";
import authGoogle from "./routes/authGoogle";
import authMagicLinkConfirm from "./routes/authMagicLinkConfirm";
import authMagicLinkSend from "./routes/authMagicLinkSend";
import authPasswordReset from "./routes/authPasswordReset";
import authPasswordResetConfirm from "./routes/authPasswordResetConfirm";
import authRegister from "./routes/authRegister";
import badgeById from "./routes/badgeById";
import badgeCreate from "./routes/badgeCreate";
import badgeList from "./routes/badgeList";
import badgeUpdate from "./routes/badgeUpdate";
import badgeUserList from "./routes/badgeUserList";
import bottleAliasDelete from "./routes/bottleAliasDelete";
import bottleAliasList from "./routes/bottleAliasList";
import bottleAliasUpdate from "./routes/bottleAliasUpdate";
import bottleAliasUpsert from "./routes/bottleAliasUpsert";
import bottleById from "./routes/bottleById";
import bottleCreate from "./routes/bottleCreate";
import bottleDelete from "./routes/bottleDelete";
import bottleGenerateDetails from "./routes/bottleGenerateDetails";
import bottleList from "./routes/bottleList";
import bottleMerge from "./routes/bottleMerge";
import bottlePreview from "./routes/bottlePreview";
import bottlePriceHistory from "./routes/bottlePriceHistory";
import bottlePriceList from "./routes/bottlePriceList";
import bottleReleaseById from "./routes/bottleReleaseById";
import bottleReleaseCreate from "./routes/bottleReleaseCreate";
import bottleReleaseDelete from "./routes/bottleReleaseDelete";
import bottleReleaseList from "./routes/bottleReleaseList";
import bottleReleaseUpdate from "./routes/bottleReleaseUpdate";
import bottleSeriesById from "./routes/bottleSeriesById";
import bottleSeriesCreate from "./routes/bottleSeriesCreate";
import bottleSeriesDelete from "./routes/bottleSeriesDelete";
import bottleSeriesList from "./routes/bottleSeriesList";
import bottleSeriesUpdate from "./routes/bottleSeriesUpdate";
import bottleSuggestedTagList from "./routes/bottleSuggestedTagList";
import bottleTagList from "./routes/bottleTagList";
import bottleUpdate from "./routes/bottleUpdate";
import bottleUpsert from "./routes/bottleUpsert";
import changeList from "./routes/changeList";
import collectionBottleCreate from "./routes/collectionBottleCreate";
import collectionBottleDelete from "./routes/collectionBottleDelete";
import collectionBottleList from "./routes/collectionBottleList";
import collectionList from "./routes/collectionList";
import commentCreate from "./routes/commentCreate";
import commentDelete from "./routes/commentDelete";
import commentList from "./routes/commentList";
import countryBySlug from "./routes/countryBySlug";
import countryCategoryList from "./routes/countryCategoryList";
import countryGenerateDetails from "./routes/countryGenerateDetails";
import countryList from "./routes/countryList";
import countryUpdate from "./routes/countryUpdate";
import emailResendVerification from "./routes/emailResendVerification";
import emailVerify from "./routes/emailVerify";
import entityAliasDelete from "./routes/entityAliasDelete";
import entityAliasList from "./routes/entityAliasList";
import entityById from "./routes/entityById";
import entityCategoryList from "./routes/entityCategoryList";
import entityCreate from "./routes/entityCreate";
import entityDelete from "./routes/entityDelete";
import entityGenerateDetails from "./routes/entityGenerateDetails";
import entityList from "./routes/entityList";
import entityMerge from "./routes/entityMerge";
import entityUpdate from "./routes/entityUpdate";
import eventById from "./routes/eventById";
import eventCreate from "./routes/eventCreate";
import eventList from "./routes/eventList";
import eventUpdate from "./routes/eventUpdate";
import externalSiteByType from "./routes/externalSiteByType";
import externalSiteConfigGet from "./routes/externalSiteConfigGet";
import externalSiteConfigSet from "./routes/externalSiteConfigSet";
import externalSiteCreate from "./routes/externalSiteCreate";
import externalSiteList from "./routes/externalSiteList";
import externalSiteTriggerJob from "./routes/externalSiteTriggerJob";
import externalSiteUpdate from "./routes/externalSiteUpdate";
import flightById from "./routes/flightById";
import flightCreate from "./routes/flightCreate";
import flightDelete from "./routes/flightDelete";
import flightList from "./routes/flightList";
import flightUpdate from "./routes/flightUpdate";
import friendCreate from "./routes/friendCreate";
import friendDelete from "./routes/friendDelete";
import friendList from "./routes/friendList";
import labelExtract from "./routes/labelExtract";
import notificationCount from "./routes/notificationCount";
import notificationDelete from "./routes/notificationDelete";
import notificationList from "./routes/notificationList";
import notificationUpdate from "./routes/notificationUpdate";
import priceChangeList from "./routes/priceChangeList";
import priceCreateBatch from "./routes/priceCreateBatch";
import priceList from "./routes/priceList";
import priceUpdate from "./routes/priceUpdate";
import queueInfo from "./routes/queueInfo";
import regionBySlug from "./routes/regionBySlug";
import regionCreate from "./routes/regionCreate";
import regionDelete from "./routes/regionDelete";
import regionGenerateDetails from "./routes/regionGenerateDetails";
import regionList from "./routes/regionList";
import regionUpdate from "./routes/regionUpdate";
import reviewCreate from "./routes/reviewCreate";
import reviewList from "./routes/reviewList";
import reviewUpdate from "./routes/reviewUpdate";
import search from "./routes/search";
import similarBottleList from "./routes/similarBottleList";
import smwsDistillerList from "./routes/smwsDistillerList";
import stats from "./routes/stats";
import tagByName from "./routes/tagByName";
import tagCreate from "./routes/tagCreate";
import tagList from "./routes/tagList";
import tagUpdate from "./routes/tagUpdate";
import tastingById from "./routes/tastingById";
import tastingCreate from "./routes/tastingCreate";
import tastingDelete from "./routes/tastingDelete";
import tastingImageDelete from "./routes/tastingImageDelete";
import tastingList from "./routes/tastingList";
import tastingUpdate from "./routes/tastingUpdate";
import toastCreate from "./routes/toastCreate";
import unmatchedBottleList from "./routes/unmatchedBottleList";
import userBadgeList from "./routes/userBadgeList";
import userById from "./routes/userById";
import userFlavorList from "./routes/userFlavorList";
import userList from "./routes/userList";
import userRegionList from "./routes/userRegionList";
import userTagList from "./routes/userTagList";
import userUpdate from "./routes/userUpdate";
import version from "./routes/version";

export const appRouter = router({
  auth,
  authBasic,
  authGoogle,
  authMagicLinkConfirm,
  authMagicLinkSend,
  authPasswordReset,
  authPasswordResetConfirm,
  authRegister,
  badgeById,
  badgeCreate,
  badgeList,
  badgeUpdate,
  badgeUserList,
  bottleAliasDelete,
  bottleAliasList,
  bottleAliasUpdate,
  bottleAliasUpsert,
  bottleById,
  bottleCreate,
  bottleDelete,
  bottleGenerateDetails,
  bottleList,
  bottleMerge,
  bottlePreview,
  bottlePriceHistory,
  bottlePriceList,
  bottleReleaseById,
  bottleReleaseCreate,
  bottleReleaseDelete,
  bottleReleaseList,
  bottleReleaseUpdate,
  bottleSeriesCreate,
  bottleSeriesDelete,
  bottleSeriesById,
  bottleSeriesList,
  bottleSeriesUpdate,
  bottleSuggestedTagList,
  bottleTagList,
  bottleUpdate,
  bottleUpsert,
  changeList,
  collectionBottleCreate,
  collectionBottleDelete,
  collectionBottleList,
  collectionList,
  commentCreate,
  commentDelete,
  commentList,
  countryBySlug,
  countryCategoryList,
  countryGenerateDetails,
  countryList,
  countryUpdate,
  emailResendVerification,
  emailVerify,
  entityAliasDelete,
  entityAliasList,
  entityById,
  entityCategoryList,
  entityCreate,
  entityDelete,
  entityGenerateDetails,
  entityList,
  entityMerge,
  entityUpdate,
  eventById,
  eventCreate,
  eventList,
  eventUpdate,
  externalSiteByType,
  externalSiteConfigGet,
  externalSiteConfigSet,
  externalSiteCreate,
  externalSiteList,
  externalSiteTriggerJob,
  externalSiteUpdate,
  flightById,
  flightCreate,
  flightDelete,
  flightList,
  flightUpdate,
  friendCreate,
  friendDelete,
  friendList,
  labelExtract,
  notificationCount,
  notificationDelete,
  notificationList,
  notificationUpdate,
  priceChangeList,
  priceCreateBatch,
  priceList,
  priceUpdate,
  queueInfo,
  regionBySlug,
  regionCreate,
  regionDelete,
  regionGenerateDetails,
  regionList,
  regionUpdate,
  reviewCreate,
  reviewList,
  reviewUpdate,
  search,
  similarBottleList,
  smwsDistillerList,
  stats,
  tagByName,
  tagCreate,
  tagList,
  tagUpdate,
  tastingById,
  tastingCreate,
  tastingDelete,
  tastingImageDelete,
  tastingList,
  tastingUpdate,
  toastCreate,
  unmatchedBottleList,
  userBadgeList,
  userById,
  userFlavorList,
  userList,
  userRegionList,
  userTagList,
  userUpdate,
  version,
});

export type AppRouter = typeof appRouter;

const callerFactory = createCallerFactory(appRouter);

const DEFAULTS = { user: null, maxAge: 0 };

export const createCaller = (context: Partial<Context> = DEFAULTS) => {
  return callerFactory({
    ...DEFAULTS,
    ...context,
  });
};
