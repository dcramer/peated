import type { RouterClient } from "@orpc/server";
import type { RouterUtils } from "@orpc/tanstack-query";
import { type Router } from "@peated/server/orpc/router";
import { createContext, use } from "react";

type ORPCQueryUtils = RouterUtils<RouterClient<Router>>;

export const ORPCContext = createContext<ORPCQueryUtils | undefined>(undefined);

export function useORPC(): ORPCQueryUtils {
  const orpc = use(ORPCContext);
  if (!orpc) {
    throw new Error("ORPCContext is not set up properly");
  }
  return orpc;
}
