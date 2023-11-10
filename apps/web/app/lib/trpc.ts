import { type AppRouter } from "@peated/server/trpc/router";
import {
  createTRPCProxyClient,
  createTRPCReact,
  httpBatchLink,
} from "@trpc/react-query";
import config from "~/config";

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

export function makeTRPCClient(accessToken?: string | null | undefined) {
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${config.API_SERVER}/trpc`,
        async headers() {
          return {
            authorization: accessToken ? `Bearer ${accessToken}` : "",
          };
        },
      }),
    ],
  });
}
