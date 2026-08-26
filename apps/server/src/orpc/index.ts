import { os } from "@orpc/server";
import sentryMiddleware from "@peated/orpc/server/middleware";
import type { User } from "../db/schema";
import { errorDefinitions } from "./contracts/base";

export const base = os
  .$context<{
    user: User | null;
    ip?: string;
    userAgent?: string;
  }>()
  /**
   * All errors must follow the ErrorContract interface.
   */
  .errors(errorDefinitions);

export const procedure = base.use(sentryMiddleware());
