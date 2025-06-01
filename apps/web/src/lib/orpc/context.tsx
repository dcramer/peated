import type { RouterUtils } from "@orpc/react-query";
import type { RouterClient } from "@orpc/server";
import type { Router } from "@peated/server/orpc/router";
import { createContext, use } from "react";

type ORPCReactUtils = RouterUtils<RouterClient<Router>>;

export const ORPCContext = createContext<ORPCReactUtils | undefined>(undefined);

export function useORPC(): ORPCReactUtils {
  const orpc = use(ORPCContext);
  if (!orpc) {
    throw new Error("ORPCContext is not set up properly");
  }
  return orpc;
}
