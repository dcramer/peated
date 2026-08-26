import type { InferContractRouterOutputs } from "@orpc/contract";
import activityList from "@peated/server/orpc/contracts/activity/list";
import login from "@peated/server/orpc/contracts/auth/login";
import bottleDetails from "@peated/server/orpc/contracts/bottles/details";
import bottleList from "@peated/server/orpc/contracts/bottles/list";
import entityList from "@peated/server/orpc/contracts/entities/list";
import root from "@peated/server/orpc/contracts/root";
import search from "@peated/server/orpc/contracts/search";
import userDetails from "@peated/server/orpc/contracts/users/details";

// This tree defines the routes that the stateless mock API supports.
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
  entities: {
    list: entityList,
  },
  users: {
    details: userDetails,
  },
};

export type MockOutputs = InferContractRouterOutputs<typeof mockContract>;
