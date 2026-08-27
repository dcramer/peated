import type { InferContractRouterOutputs } from "@orpc/contract";
import activityList from "@peated/server/orpc/contracts/activity/list";
import login from "@peated/server/orpc/contracts/auth/login";
import badgeDetails from "@peated/server/orpc/contracts/badges/details";
import badgeUserList from "@peated/server/orpc/contracts/badges/user-list";
import bottleGroupBottles from "@peated/server/orpc/contracts/bottleGroups/bottles";
import bottleGroupDetails from "@peated/server/orpc/contracts/bottleGroups/details";
import bottleDetails from "@peated/server/orpc/contracts/bottles/details";
import bottleList from "@peated/server/orpc/contracts/bottles/list";
import bottlePriceList from "@peated/server/orpc/contracts/bottles/prices/list";
import bottleTags from "@peated/server/orpc/contracts/bottles/tags";
import changeList from "@peated/server/orpc/contracts/changes/list";
import collectionBottleDelete from "@peated/server/orpc/contracts/collections/bottles/delete";
import collectionBottleList from "@peated/server/orpc/contracts/collections/bottles/list";
import collectionBottleUpdate from "@peated/server/orpc/contracts/collections/bottles/update";
import commentList from "@peated/server/orpc/contracts/comments/list";
import countryDetails from "@peated/server/orpc/contracts/countries/details";
import countryList from "@peated/server/orpc/contracts/countries/list";
import entityCatalog from "@peated/server/orpc/contracts/entities/catalog";
import entityDetails from "@peated/server/orpc/contracts/entities/details";
import entityList from "@peated/server/orpc/contracts/entities/list";
import eventList from "@peated/server/orpc/contracts/events/list";
import flightDetails from "@peated/server/orpc/contracts/flights/details";
import flightList from "@peated/server/orpc/contracts/flights/list";
import friendCreate from "@peated/server/orpc/contracts/friends/create";
import friendDelete from "@peated/server/orpc/contracts/friends/delete";
import friendList from "@peated/server/orpc/contracts/friends/list";
import notificationCount from "@peated/server/orpc/contracts/notifications/count";
import notificationList from "@peated/server/orpc/contracts/notifications/list";
import priceChangeList from "@peated/server/orpc/contracts/prices/change-list";
import regionDetails from "@peated/server/orpc/contracts/regions/details";
import regionList from "@peated/server/orpc/contracts/regions/list";
import reviewList from "@peated/server/orpc/contracts/reviews/list";
import root from "@peated/server/orpc/contracts/root";
import search from "@peated/server/orpc/contracts/search";
import smwsDistillerList from "@peated/server/orpc/contracts/smws/distiller-list";
import stats from "@peated/server/orpc/contracts/stats";
import tastingDetails from "@peated/server/orpc/contracts/tastings/details";
import tastingList from "@peated/server/orpc/contracts/tastings/list";
import userActivityList from "@peated/server/orpc/contracts/users/activity/list";
import userBadgeList from "@peated/server/orpc/contracts/users/badge-list";
import userDetails from "@peated/server/orpc/contracts/users/details";
import userFlavorList from "@peated/server/orpc/contracts/users/flavor-list";
import userLibraryStats from "@peated/server/orpc/contracts/users/library-stats";
import userRegionList from "@peated/server/orpc/contracts/users/region-list";
import userTastingStats from "@peated/server/orpc/contracts/users/tasting-stats";

// The mock API supports only the routes listed here.
export const mockContract = {
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
    tags: bottleTags,
  },
  changes: {
    list: changeList,
  },
  comments: {
    list: commentList,
  },
  collections: {
    bottles: {
      delete: collectionBottleDelete,
      list: collectionBottleList,
      update: collectionBottleUpdate,
    },
  },
  countries: {
    details: countryDetails,
    list: countryList,
  },
  entities: {
    catalog: entityCatalog,
    details: entityDetails,
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
  reviews: {
    list: reviewList,
  },
  smws: {
    distillerList: smwsDistillerList,
  },
  tastings: {
    details: tastingDetails,
    list: tastingList,
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
};

export type MockOutputs = InferContractRouterOutputs<typeof mockContract>;
