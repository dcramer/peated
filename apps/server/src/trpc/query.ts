import {
  QueryClient,
  defaultShouldDehydrateQuery,
  isServer,
} from "@tanstack/react-query";
// TODO: only in react 19
// import { cache } from "react";

// https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
const makeQueryClient = () => {
  return new QueryClient({
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
    },
  });
};

// TODO:
// const getServerQueryClient = cache(() => makeQueryClient());
const getServerQueryClient = makeQueryClient;

let browserQueryClient: QueryClient | undefined = undefined;

// isServerComponent must be true for any server component
// and false for any client component (even if server rendered)
export function getQueryClient(isServerComponent = true) {
  // react.cache only works for server components
  if (isServerComponent) return getServerQueryClient();

  if (isServer) return makeQueryClient();

  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
