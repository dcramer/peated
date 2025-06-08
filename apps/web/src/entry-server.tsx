import { createORPCReactQueryUtils } from "@orpc/react-query";
import { QueryClient } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { ErrorPage404 } from "./components/errorPage";
import { getServerClient } from "./lib/orpc/client.server";
import { routeTree } from "./routeTree.gen";

export async function render(url: string, context: any = {}) {
  const orpcClient = getServerClient(context);
  const orpc = createORPCReactQueryUtils(orpcClient);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
      },
    },
  });

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
    defaultPendingMinMs: 0,
    defaultNotFoundComponent: () => <ErrorPage404 />,
  });

  // Load the route and execute loaders
  await router.load();

  // Render the app
  const html = renderToString(<RouterProvider router={router} />);

  // Serialize the query client state for hydration
  const dehydratedState = queryClient.getQueryCache().getAll();

  return {
    html,
    state: dehydratedState,
    statusCode: router.hasNotFoundMatch?.() ? 404 : 200,
  };
}
