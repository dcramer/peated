import {
  QueryClient,
  defaultShouldDehydrateQuery,
} from "@tanstack/react-query";
import { cache } from "react";

// https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
const makeQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
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

const getServerQueryClient = cache(() => makeQueryClient());

// isServerComponent must be true for any server component
// and false for any client component (even if server rendered)
function getQueryClient(isServerComponent = true) {
  if (isServerComponent) return getServerQueryClient();
  return makeQueryClient();
}

export default getQueryClient;
