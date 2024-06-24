import { QueryClient } from "@tanstack/react-query";

let queryClient: QueryClient | null = null;

type QueryClientConfig = {
  ssr: boolean;
};

export function clearQueryClient() {
  queryClient = null;
}

export function getQueryClient({ ssr }: QueryClientConfig): QueryClient {
  if (queryClient === null) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          networkMode: "offlineFirst",
          // suspense: true,
          retry: false,
          staleTime: ssr ? 0 : 5 * 60 * 1000, // 5 minutes
        },
      },
    });
  }
  return queryClient;
}

export default function useSingletonQueryClient(config: QueryClientConfig) {
  return getQueryClient(config);
}
