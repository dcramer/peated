import { type AppRouter } from "@peated/server/trpc/router";
import {
  TRPCClientError,
  createTRPCReact,
  type CreateTRPCReact,
  type inferReactQueryProcedureOptions,
} from "@trpc/react-query";
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";

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

// TODO: im not even sure what the difference is within this implementation, but it doesnt
// provide us a great wait to pass in credentials vs our context provider
// export const trpcClient = createTRPCNext<AppRouter>({
//   ssr: true,
//   ssrPrepass,
//   config(opts) {
//     return {
//       suspense: true,
//       links: [
//         sentryLink(),
//         httpBatchLink({
//           url: `${config.API_SERVER}/trpc`,
//           // async headers() {
//           //   const session = await getSession();
//           //   return {
//           //     authorization: session.accessToken
//           //       ? `Bearer ${session.accessToken}`
//           //       : "",
//           //   };
//           // },
//         }),
//       ],
//     };
//   },
// });

export function isTRPCClientError(
  cause: unknown,
): cause is TRPCClientError<AppRouter> {
  return (
    cause instanceof TRPCClientError || Object.hasOwn(cause as any, "data")
  );
}

export type ReactQueryOptions = inferReactQueryProcedureOptions<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
