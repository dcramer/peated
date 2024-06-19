import { QueryClient } from "@tanstack/react-query";

let queryClient: QueryClient | null = null;

type QueryClientConfig = {
  ssr: boolean;
};

export function getQueryClient({ ssr }: QueryClientConfig): QueryClient {
  if (queryClient === null) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          networkMode: "offlineFirst",
          // suspense: true,
          retry: false,
          staleTime: ssr ? 0 : 300,
          gcTime: ssr ? 0 : 300,
        },
      },
    });
  }
  return queryClient;
}

export default function useSingletonQueryClient(config: QueryClientConfig) {
  return getQueryClient(config);
}
