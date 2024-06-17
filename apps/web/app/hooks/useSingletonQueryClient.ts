import { QueryClient } from "@tanstack/react-query";

let queryClient: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (queryClient === null) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          networkMode: "offlineFirst",
          // suspense: true,
          retry: false,
          staleTime: 60 * 1000,
        },
      },
    });
  }
  return queryClient;
}

export default function useSingletonQueryClient() {
  return getQueryClient();
}
