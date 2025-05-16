import { createRouterClient } from "@orpc/server";
import type { User } from "@peated/server/db/schema";
import router from "./routes";

export { default as router } from "./routes";

export type Router = typeof router;
// export type { Router } from "./routes";

interface ClientContext {
  user?: User | null;
}

export const routerClient = createRouterClient(router, {
  context: ({ user }: ClientContext) => ({ user: user ?? null }),
});
