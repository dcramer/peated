import type { InferContractRouterOutputs } from "@orpc/contract";
import activityList from "@peated/server/orpc/contracts/activity/list";
import login from "@peated/server/orpc/contracts/auth/login";
import badgeDetails from "@peated/server/orpc/contracts/badges/details";
import badgeUserList from "@peated/server/orpc/contracts/badges/user-list";
import bottleGroupBottles from "@peated/server/orpc/contracts/bottleGroups/bottles";
import bottleGroupDetails from "@peated/server/orpc/contracts/bottleGroups/details";
import bottlerList from "@peated/server/orpc/contracts/bottlers/list";
import bottleDetails from "@peated/server/orpc/contracts/bottles/details";
import bottleFlavorProfile from "@peated/server/orpc/contracts/bottles/flavor-profile";
import bottleList from "@peated/server/orpc/contracts/bottles/list";
import bottlePriceList from "@peated/server/orpc/contracts/bottles/prices/list";
import bottleRecommendations from "@peated/server/orpc/contracts/bottles/recommendations";
import bottleSuggestedTags from "@peated/server/orpc/contracts/bottles/suggested-tags";
import bottleTags from "@peated/server/orpc/contracts/bottles/tags";
import brandList from "@peated/server/orpc/contracts/brands/list";
import changeList from "@peated/server/orpc/contracts/changes/list";
import collectionBottleCreate from "@peated/server/orpc/contracts/collections/bottles/create";
import collectionBottleDelete from "@peated/server/orpc/contracts/collections/bottles/delete";
import collectionBottleList from "@peated/server/orpc/contracts/collections/bottles/list";
import collectionBottleUpdate from "@peated/server/orpc/contracts/collections/bottles/update";
import commentList from "@peated/server/orpc/contracts/comments/list";
import companyList from "@peated/server/orpc/contracts/companies/list";
import countryDetails from "@peated/server/orpc/contracts/countries/details";
import countryList from "@peated/server/orpc/contracts/countries/list";
import distilleryList from "@peated/server/orpc/contracts/distilleries/list";
import entityCatalog from "@peated/server/orpc/contracts/entities/catalog";
import entityCreate from "@peated/server/orpc/contracts/entities/create";
import entityDetails from "@peated/server/orpc/contracts/entities/details";
import entityEventList from "@peated/server/orpc/contracts/entities/events/list";
import entityFlavorProfile from "@peated/server/orpc/contracts/entities/flavor-profile";
import entityList from "@peated/server/orpc/contracts/entities/list";
import entityResolve from "@peated/server/orpc/contracts/entities/resolve";
import eventList from "@peated/server/orpc/contracts/events/list";
import externalReviewList from "@peated/server/orpc/contracts/externalReviews/list";
import flightDetails from "@peated/server/orpc/contracts/flights/details";
import flightList from "@peated/server/orpc/contracts/flights/list";
import friendCreate from "@peated/server/orpc/contracts/friends/create";
import friendDelete from "@peated/server/orpc/contracts/friends/delete";
import friendList from "@peated/server/orpc/contracts/friends/list";
import memberReviewDetails from "@peated/server/orpc/contracts/memberReviews/details";
import memberReviewList from "@peated/server/orpc/contracts/memberReviews/list";
import notificationCount from "@peated/server/orpc/contracts/notifications/count";
import notificationList from "@peated/server/orpc/contracts/notifications/list";
import priceChangeList from "@peated/server/orpc/contracts/prices/change-list";
import regionDetails from "@peated/server/orpc/contracts/regions/details";
import regionFlavorProfile from "@peated/server/orpc/contracts/regions/flavor-profile";
import regionList from "@peated/server/orpc/contracts/regions/list";
import root from "@peated/server/orpc/contracts/root";
import search from "@peated/server/orpc/contracts/search";
import smwsDistillerList from "@peated/server/orpc/contracts/smws/distiller-list";
import stats from "@peated/server/orpc/contracts/stats";
import tagBottles from "@peated/server/orpc/contracts/tags/bottles";
import tastingCreate from "@peated/server/orpc/contracts/tastings/create";
import tastingDetails from "@peated/server/orpc/contracts/tastings/details";
import tastingList from "@peated/server/orpc/contracts/tastings/list";
import tastingPhotoIdentification from "@peated/server/orpc/contracts/tastings/photo-identification";
import userActivityList from "@peated/server/orpc/contracts/users/activity/list";
import userBadgeList from "@peated/server/orpc/contracts/users/badge-list";
import userDetails from "@peated/server/orpc/contracts/users/details";
import userFlavorList from "@peated/server/orpc/contracts/users/flavor-list";
import userLibraryStats from "@peated/server/orpc/contracts/users/library-stats";
import userRegionList from "@peated/server/orpc/contracts/users/region-list";
import userTastingStats from "@peated/server/orpc/contracts/users/tasting-stats";

// The mock API supports only the routes listed here.
export const mockContract = {
  tags: { bottles: tagBottles },
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
    flavorProfile: bottleFlavorProfile,
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
    flavorProfile: entityFlavorProfile,
    catalog: entityCatalog,
    create: entityCreate,
    details: entityDetails,
    events: {
      list: entityEventList,
    },
    list: entityList,
    resolve: entityResolve,
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
  memberReviews: {
    details: memberReviewDetails,
    list: memberReviewList,
  },
  notifications: {
    count: notificationCount,
    list: notificationList,
  },
  prices: {
    changeList: priceChangeList,
  },
  regions: {
    flavorProfile: regionFlavorProfile,
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
};

export type MockOutputs = InferContractRouterOutputs<typeof mockContract>;
