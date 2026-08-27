import type { AnyContractRouter } from "@orpc/contract";
import { implement as implementContract, os } from "@orpc/server";
import sentryMiddleware from "@peated/orpc/server/middleware";
import type { Context } from "./context";
import { errorDefinitions } from "./contracts/base";

export const base = os
  .$context<Context>()
  /**
   * All errors must follow the ErrorContract interface.
   */
  .errors(errorDefinitions);

// routes/index.ts must assemble the final router with api.router(...). This is
// the production boundary that applies global middleware to every route.
export const api = base.use(sentryMiddleware());
export const procedure = api;

export function implement<T extends AnyContractRouter>(contract: T) {
  return implementContract<T, Context>(contract);
}
