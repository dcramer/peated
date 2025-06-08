import { createORPCReactQueryUtils } from "@orpc/react-query";
import { QueryClient, dehydrate } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { ErrorPage404 } from "./components/errorPage";
import { getServerClient } from "./lib/orpc/client.server";
import { getQueryClient } from "./lib/queryClient";
import { routeTree } from "./routeTree.gen";

export async function render(url: string, context: any = {}) {
  const orpcClient = getServerClient(context);
  const orpc = createORPCReactQueryUtils(orpcClient);
  const queryClient = getQueryClient();

  // Create memory history for server-side routing
  const memoryHistory = createMemoryHistory({
    initialEntries: [url],
  });

  const router = createRouter({
    routeTree,
    history: memoryHistory,
    context: {
      queryClient,
      orpc,
      orpcClient,
    },
    defaultPendingMinMs: 16,
    defaultNotFoundComponent: () => <ErrorPage404 />,
    dehydrate: () => {
      return {
        dehydratedState: dehydrate(queryClient),
      };
    },
  });

  // Load the route and execute loaders
  await router.load();

  // Render the app
  const html = renderToString(<RouterProvider router={router} />);

  return {
    html,
    statusCode: router.hasNotFoundMatch?.() ? 404 : 200,
  };
}
