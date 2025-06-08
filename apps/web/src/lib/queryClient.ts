import {
  QueryClient,
  defaultShouldDehydrateQuery,
  isServer,
} from "@tanstack/react-query";

// https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
const createQueryClient = ({ isServer }: { isServer: boolean }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnMount: false,
        networkMode: "offlineFirst",
        retry: !isServer,
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
        onSuccess: async (data, variables, context) => {
          // Invalidate all queries in the react-query cache:
          await queryClient.invalidateQueries();
        },
      },
    },
  });
  return queryClient;
};

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (isServer) return createQueryClient({ isServer: true });

  if (!browserQueryClient) {
    browserQueryClient = createQueryClient({ isServer: false });
  }
  return browserQueryClient;
}
