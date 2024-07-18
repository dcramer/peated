"use client";

import { getLinks } from "@peated/server/trpc/links";
import { getQueryClient } from "@peated/server/trpc/query";
import { type AppRouter } from "@peated/server/trpc/router";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createTRPCReact,
  type CreateTRPCReact,
  type inferReactQueryProcedureOptions,
} from "@trpc/react-query";
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import type { ComponentProps } from "react";
import { useState } from "react";

export { isTRPCClientError } from "@peated/server/trpc/client";

export const trpc: CreateTRPCReact<AppRouter, unknown> =
  createTRPCReact<AppRouter>({
    overrides: {
      useMutation: {
        /**
         * This function is called whenever a `.useMutation` succeeds
         **/
        async onSuccess(opts) {
          /**
           * @note that order here matters:
           * The order here allows route changes in `onSuccess` without
           * having a flash of content change whilst redirecting.
           **/
          // Calls the `onSuccess` defined in the `useQuery()`-options:
          await opts.originalFn();
          // Invalidate all queries in the react-query cache:
          await opts.queryClient.invalidateQueries();
        },
      },
    },
  });

export type ReactQueryOptions = inferReactQueryProcedureOptions<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export function TRPCProvider({
  accessToken,
  apiServer,
  ...props
}: { accessToken?: string | null; apiServer: string } & Omit<
  ComponentProps<typeof trpc.Provider>,
  "client" | "queryClient"
>) {
  const queryClient = getQueryClient(false);

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: getLinks({
        apiServer,
        accessToken,
        batch: true,
      }),
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
