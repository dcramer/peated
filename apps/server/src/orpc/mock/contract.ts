import type { InferContractRouterOutputs } from "@orpc/contract";
import activityList from "@peated/server/orpc/contracts/activity/list";
import login from "@peated/server/orpc/contracts/auth/login";
import bottleDetails from "@peated/server/orpc/contracts/bottles/details";
import bottleList from "@peated/server/orpc/contracts/bottles/list";
import collectionBottleList from "@peated/server/orpc/contracts/collections/bottles/list";
import countryDetails from "@peated/server/orpc/contracts/countries/details";
import countryList from "@peated/server/orpc/contracts/countries/list";
import entityDetails from "@peated/server/orpc/contracts/entities/details";
import entityList from "@peated/server/orpc/contracts/entities/list";
import regionDetails from "@peated/server/orpc/contracts/regions/details";
import regionList from "@peated/server/orpc/contracts/regions/list";
import root from "@peated/server/orpc/contracts/root";
import search from "@peated/server/orpc/contracts/search";
import tastingDetails from "@peated/server/orpc/contracts/tastings/details";
import tastingList from "@peated/server/orpc/contracts/tastings/list";
import userDetails from "@peated/server/orpc/contracts/users/details";

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
};

export type MockOutputs = InferContractRouterOutputs<typeof mockContract>;
