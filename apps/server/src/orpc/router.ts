import { createRouterClient } from "@orpc/server";
import router from "./routes";

export { default as router } from "./routes";

export type Router = typeof router;
// export type { Router } from "./routes";

export const routerClient = createRouterClient(router, {
  context: { user: null },
});
