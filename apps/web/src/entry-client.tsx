import { createORPCReactQueryUtils } from "@orpc/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import React, { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { ErrorPage404 } from "./components/errorPage";
import { createBrowserClient } from "./lib/orpc/client";
import { routeTree } from "./routeTree.gen";

// Create router with browser-specific setup
function createBrowserRouter(queryClient: QueryClient) {
  const orpcClient = createBrowserClient();
  const orpc = createORPCReactQueryUtils(orpcClient);

  return createRouter({
    routeTree,
    context: {
      queryClient,
      orpc,
      orpcClient,
    },
    defaultNotFoundComponent: () => <ErrorPage404 />,
  });
}

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

// Hydrate query client from server state if available
if (typeof window !== "undefined" && (window as any).__INITIAL_STATE__) {
  // TODO: Properly hydrate query client state here if needed
  // queryClient.setQueryData(...)
}

const router = createBrowserRouter(queryClient);

hydrateRoot(
  document.getElementById("root")!,
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);
