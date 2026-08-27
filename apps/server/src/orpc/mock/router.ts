import { mockOS } from "./implementer";
import activityList from "./routes/activity/list";
import login from "./routes/auth/login";
import bottleDetails from "./routes/bottles/details";
import bottleList from "./routes/bottles/list";
import collectionBottleList from "./routes/collections/bottles/list";
import countryDetails from "./routes/countries/details";
import countryList from "./routes/countries/list";
import entityDetails from "./routes/entities/details";
import entityList from "./routes/entities/list";
import regionDetails from "./routes/regions/details";
import regionList from "./routes/regions/list";
import root from "./routes/root";
import search from "./routes/search";
import tastingDetails from "./routes/tastings/details";
import tastingList from "./routes/tastings/list";
import userDetails from "./routes/users/details";

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
    details: entityDetails,
    list: entityList,
  },
  regions: {
    details: regionDetails,
    list: regionList,
  },
  tastings: {
    details: tastingDetails,
    list: tastingList,
  },
  users: {
    details: userDetails,
  },
});
