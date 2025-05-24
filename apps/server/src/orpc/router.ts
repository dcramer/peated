import type { InferRouterInputs, InferRouterOutputs } from "@orpc/server";
import { createRouterClient } from "@orpc/server";
import type { User } from "@peated/server/db/schema";
import router from "./routes";

export default router;

export type Router = typeof router;
// export type { Router } from "./routes";
export type Inputs = InferRouterInputs<Router>;
export type Outputs = InferRouterOutputs<Router>;

interface ClientContext {
  user?: User | null;
}

export const routerClient = createRouterClient(router, {
  context: ({ user }: ClientContext) => ({ user: user ?? null }),
});
