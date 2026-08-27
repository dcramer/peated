import { mockOS } from "./implementer";
import activityList from "./routes/activity/list";
import login from "./routes/auth/login";
import bottleDetails from "./routes/bottles/details";
import bottleList from "./routes/bottles/list";
import bottleTags from "./routes/bottles/tags";
import collectionBottleList from "./routes/collections/bottles/list";
import commentList from "./routes/comments/list";
import countryDetails from "./routes/countries/details";
import countryList from "./routes/countries/list";
import entityCatalog from "./routes/entities/catalog";
import entityDetails from "./routes/entities/details";
import entityList from "./routes/entities/list";
import flightDetails from "./routes/flights/details";
import flightList from "./routes/flights/list";
import notificationCount from "./routes/notifications/count";
import regionDetails from "./routes/regions/details";
import regionList from "./routes/regions/list";
import reviewList from "./routes/reviews/list";
import root from "./routes/root";
import search from "./routes/search";
import tastingDetails from "./routes/tastings/details";
import tastingList from "./routes/tastings/list";
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
});
