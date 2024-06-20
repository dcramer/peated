import { sentryLink } from "@peated/server/src/lib/trpc";
import { type AppRouter } from "@peated/server/trpc/router";
import { createTRPCNext } from "@trpc/next";
import {
  TRPCClientError,
  createTRPCReact,
  httpBatchLink,
} from "@trpc/react-query";
import config from "../config";

export const trpcClient = createTRPCNext<AppRouter>({
  config(opts) {
    return {
      links: [
        sentryLink(),
        httpBatchLink({
          url: `${config.API_SERVER}/trpc`,
          // async headers() {
          //   const session = await getSession();
          //   return {
          //     authorization: session.accessToken
          //       ? `Bearer ${session.accessToken}`
          //       : "",
          //   };
          // },
        }),
      ],
      // ssr: false,
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
    };
  },
});

export const trpc = createTRPCReact<AppRouter>({
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

export function isTRPCClientError(
  cause: unknown,
): cause is TRPCClientError<AppRouter> {
  return (
    cause instanceof TRPCClientError || Object.hasOwn(cause as any, "data")
  );
}
