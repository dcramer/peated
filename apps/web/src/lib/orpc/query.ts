import {
  QueryClient,
  defaultShouldDehydrateQuery,
  isServer,
} from "@tanstack/react-query";
// TODO: only in react 19
// import { cache } from "react";

// https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
const createQueryClient = () => {
  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnMount: false,
        networkMode: "offlineFirst",
        retry: false,
        staleTime: 5 * 60 * 1000, // 5 minutes
      },
      dehydrate: {
        // per default, only successful Queries are included,
        // this includes pending Queries as well
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      mutations: {
        onSuccess: () => {
          // Invalidate all queries in the react-query cache:
          void queryClient.invalidateQueries();
        },
      },
    },
  });
  return queryClient;
};

const FORM_QUERY_SCOPE = { scope: "form" } as const;

/**
 * Isolates form initialization from cached read views and discards the snapshot
 * as soon as the form unmounts.
 */
export function formQueryOptions<
  const TOptions extends { queryKey: readonly unknown[] },
>(options: TOptions) {
  return {
    ...options,
    queryKey: [...options.queryKey, FORM_QUERY_SCOPE],
    gcTime: 0,
    staleTime: "static" as const,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  };
}

/**
 * Starts a client query from data the server loaded for this page view and
 * discards it when the page unmounts.
 *
 * A cached copy would win over newer server data on the next visit, because
 * `initialData` only applies to a new query. Invalidation does not fix that:
 * TanStack Query skips inactive queries that never fetched, and our default
 * `refetchOnMount: false` keeps the old copy on remount.
 */
export function serverDataQueryOptions<
  const TOptions extends { queryKey: readonly unknown[] },
  TData,
>(options: TOptions, initialData: TData) {
  return {
    ...options,
    initialData,
    gcTime: 0,
  };
}

let browserQueryClient: QueryClient | undefined = undefined;

// isServerComponent must be true for any server component
// and false for any client component (even if server rendered)
export function getQueryClient(isServerComponent = true) {
  // react.cache only works for server components
  if (isServerComponent) return createQueryClient();

  if (isServer) return createQueryClient();

  if (!browserQueryClient) {
    browserQueryClient = createQueryClient();
  }
  return browserQueryClient;
}
