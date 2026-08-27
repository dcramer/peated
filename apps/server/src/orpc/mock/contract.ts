import type { InferContractRouterOutputs } from "@orpc/contract";
import activityList from "@peated/server/orpc/contracts/activity/list";
import login from "@peated/server/orpc/contracts/auth/login";
import bottleDetails from "@peated/server/orpc/contracts/bottles/details";
import bottleList from "@peated/server/orpc/contracts/bottles/list";
import bottleTags from "@peated/server/orpc/contracts/bottles/tags";
import collectionBottleList from "@peated/server/orpc/contracts/collections/bottles/list";
import commentList from "@peated/server/orpc/contracts/comments/list";
import countryDetails from "@peated/server/orpc/contracts/countries/details";
import countryList from "@peated/server/orpc/contracts/countries/list";
import entityCatalog from "@peated/server/orpc/contracts/entities/catalog";
import entityDetails from "@peated/server/orpc/contracts/entities/details";
import entityList from "@peated/server/orpc/contracts/entities/list";
import flightDetails from "@peated/server/orpc/contracts/flights/details";
import flightList from "@peated/server/orpc/contracts/flights/list";
import notificationCount from "@peated/server/orpc/contracts/notifications/count";
import regionDetails from "@peated/server/orpc/contracts/regions/details";
import regionList from "@peated/server/orpc/contracts/regions/list";
import reviewList from "@peated/server/orpc/contracts/reviews/list";
import root from "@peated/server/orpc/contracts/root";
import search from "@peated/server/orpc/contracts/search";
import tastingDetails from "@peated/server/orpc/contracts/tastings/details";
import tastingList from "@peated/server/orpc/contracts/tastings/list";
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
  activity: {
    list: activityList,
  },
  auth: {
    login,
  },
  bottles: {
    details: bottleDetails,
    list: bottleList,
    tags: bottleTags,
  },
  comments: {
    list: commentList,
  },
  collections: {
    bottles: {
      list: collectionBottleList,
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
  flights: {
    details: flightDetails,
    list: flightList,
  },
  notifications: {
    count: notificationCount,
  },
  regions: {
    details: regionDetails,
    list: regionList,
  },
  reviews: {
    list: reviewList,
  },
  tastings: {
    details: tastingDetails,
    list: tastingList,
  },
  users: {
    badgeList: userBadgeList,
    details: userDetails,
    flavorList: userFlavorList,
    libraryStats: userLibraryStats,
    regionList: userRegionList,
    tastingStats: userTastingStats,
  },
};

export type MockOutputs = InferContractRouterOutputs<typeof mockContract>;
