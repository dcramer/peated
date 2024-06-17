import * as Sentry from "@sentry/remix";
import type { DataTag, QueryKey } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";

let queryClient: QueryClient | null = null;

// Instruments QueryClient, such that emits cache spans indicating
// hit / miss behaviour of local query cache.
// TODO: figure out if this data can be attached to parent transaction.
class InstrumentedQueryClient extends QueryClient {
  getQueryData<
    TQueryFnData = unknown,
    TTaggedQueryKey extends QueryKey = QueryKey,
    TInferredQueryFnData = TTaggedQueryKey extends DataTag<
      unknown,
      infer TaggedValue
    >
      ? TaggedValue
      : TQueryFnData,
  >(queryKey: TTaggedQueryKey): TInferredQueryFnData | undefined;
  getQueryData(queryKey: QueryKey) {
    const options = this.defaultQueryOptions({ queryKey });
    const cachedQuery = this.getQueryCache().get(options.queryHash);
    let hit = !!cachedQuery?.state.data;
    // Create a root transaction to attach cache spans to:
    Sentry.startSpan(
      {
        name: "react-query-transaction",
      },
      async () => {
        // The cache span itself:
        Sentry.startSpan(
          {
            name: options.queryHash,
            op: "cache.get_item",
          },
          (span) => {
            span.setAttribute("cache.hit", hit);
          },
        );
      },
    );
    return cachedQuery?.state.data;
  }
}

export function getQueryClient(): QueryClient {
  if (queryClient === null) {
    queryClient = new InstrumentedQueryClient({
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
