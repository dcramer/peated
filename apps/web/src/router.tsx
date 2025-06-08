import { createORPCReactQueryUtils } from "@orpc/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { ErrorPage404 } from "./components/errorPage";
import { type ClientContext, createBrowserClient } from "./lib/orpc/client";
import { getServerClient } from "./lib/orpc/client.server";
import { getQueryClient } from "./lib/queryClient";
import { routeTree } from "./routeTree.gen";

export interface CreateRouterOptions {
  context?: ClientContext;
}

export function createRouter({ context = {} }: CreateRouterOptions = {}) {
  const queryClient = getQueryClient();

  // Create appropriate ORPC client based on environment
  const orpcClient =
    typeof window !== "undefined"
      ? createBrowserClient(context)
      : getServerClient(context);

  const orpc = createORPCReactQueryUtils(orpcClient);

  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    context: {
      queryClient,
      orpc,
      orpcClient,
    },
    defaultPendingMinMs: 16,
    defaultNotFoundComponent: () => <ErrorPage404 />,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
