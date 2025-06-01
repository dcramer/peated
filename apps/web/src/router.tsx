import { createORPCReactQueryUtils } from "@orpc/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { ErrorPage404 } from "./components/errorPage";
import { getServerClient } from "./lib/orpc/client.server";
import { getQueryClient } from "./lib/orpc/query";
import { routeTree } from "./routeTree.gen";

export function createRouter() {
  const orpcClient = getServerClient();
  const orpc = createORPCReactQueryUtils(orpcClient);

  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    context: {
      queryClient: getQueryClient(),
      orpc,
    },
    defaultNotFoundComponent: () => <ErrorPage404 />,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
