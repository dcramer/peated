import { mockOS } from "./implementer";
import activityList from "./routes/activity/list";
import login from "./routes/auth/login";
import badgeDetails from "./routes/badges/details";
import badgeUserList from "./routes/badges/user-list";
import bottleGroupBottles from "./routes/bottleGroups/bottles";
import bottleGroupDetails from "./routes/bottleGroups/details";
import bottlerList from "./routes/bottlers/list";
import bottleDetails from "./routes/bottles/details";
import bottleList from "./routes/bottles/list";
import bottlePriceList from "./routes/bottles/prices/list";
import bottleRecommendations from "./routes/bottles/recommendations";
import bottleSuggestedTags from "./routes/bottles/suggested-tags";
import bottleTags from "./routes/bottles/tags";
import brandList from "./routes/brands/list";
import changeList from "./routes/changes/list";
import collectionBottleCreate from "./routes/collections/bottles/create";
import collectionBottleDelete from "./routes/collections/bottles/delete";
import collectionBottleList from "./routes/collections/bottles/list";
import collectionBottleUpdate from "./routes/collections/bottles/update";
import commentList from "./routes/comments/list";
import companyList from "./routes/companies/list";
import countryDetails from "./routes/countries/details";
import countryList from "./routes/countries/list";
import distilleryList from "./routes/distilleries/list";
import entityCatalog from "./routes/entities/catalog";
import entityCreate from "./routes/entities/create";
import entityDetails from "./routes/entities/details";
import entityEventList from "./routes/entities/events/list";
import entityList from "./routes/entities/list";
import eventList from "./routes/events/list";
import externalReviewList from "./routes/externalReviews/list";
import flightDetails from "./routes/flights/details";
import flightList from "./routes/flights/list";
import friendCreate from "./routes/friends/create";
import friendDelete from "./routes/friends/delete";
import friendList from "./routes/friends/list";
import notificationCount from "./routes/notifications/count";
import notificationList from "./routes/notifications/list";
import priceChangeList from "./routes/prices/change-list";
import regionDetails from "./routes/regions/details";
import regionList from "./routes/regions/list";
import root from "./routes/root";
import search from "./routes/search";
import smwsDistillerList from "./routes/smws/distiller-list";
import stats from "./routes/stats";
import tastingCreate from "./routes/tastings/create";
import tastingDetails from "./routes/tastings/details";
import tastingList from "./routes/tastings/list";
import tastingPhotoIdentification from "./routes/tastings/photo-identification";
import userActivityList from "./routes/users/activity/list";
import userBadgeList from "./routes/users/badge-list";
import userDetails from "./routes/users/details";
import userFlavorList from "./routes/users/flavor-list";
import userLibraryStats from "./routes/users/library-stats";
import userRegionList from "./routes/users/region-list";
import userTastingStats from "./routes/users/tasting-stats";

// Requests for routes not listed here return 404 from the mock server.
export const mockRouter = mockOS.router({
  root,
  search,
  stats,
  activity: {
    list: activityList,
  },
  auth: {
    login,
  },
  badges: {
    details: badgeDetails,
    userList: badgeUserList,
  },
  bottleGroups: {
    bottles: bottleGroupBottles,
    details: bottleGroupDetails,
  },
  bottles: {
    details: bottleDetails,
    list: bottleList,
    prices: {
      list: bottlePriceList,
    },
    recommendations: bottleRecommendations,
    suggestedTags: bottleSuggestedTags,
    tags: bottleTags,
  },
  bottlers: { list: bottlerList },
  brands: { list: brandList },
  changes: {
    list: changeList,
  },
  comments: {
    list: commentList,
  },
  companies: { list: companyList },
  collections: {
    bottles: {
      create: collectionBottleCreate,
      delete: collectionBottleDelete,
      list: collectionBottleList,
      update: collectionBottleUpdate,
    },
  },
  countries: {
    details: countryDetails,
    list: countryList,
  },
  distilleries: { list: distilleryList },
  entities: {
    catalog: entityCatalog,
    create: entityCreate,
    details: entityDetails,
    events: {
      list: entityEventList,
    },
    list: entityList,
  },
  events: {
    list: eventList,
  },
  flights: {
    details: flightDetails,
    list: flightList,
  },
  friends: {
    create: friendCreate,
    delete: friendDelete,
    list: friendList,
  },
  notifications: {
    count: notificationCount,
    list: notificationList,
  },
  prices: {
    changeList: priceChangeList,
  },
  regions: {
    details: regionDetails,
    list: regionList,
  },
  externalReviews: {
    list: externalReviewList,
  },
  smws: {
    distillerList: smwsDistillerList,
  },
  tastings: {
    create: tastingCreate,
    details: tastingDetails,
    list: tastingList,
    photoIdentification: tastingPhotoIdentification,
  },
  users: {
    activity: {
      list: userActivityList,
    },
    badgeList: userBadgeList,
    details: userDetails,
    flavorList: userFlavorList,
    libraryStats: userLibraryStats,
    regionList: userRegionList,
    tastingStats: userTastingStats,
  },
});
