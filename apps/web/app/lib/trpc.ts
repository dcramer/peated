import { type AppRouter } from "@peated/server/trpc/router";
import { captureException } from "@sentry/react";
import {
  createTRPCProxyClient,
  createTRPCReact,
  httpBatchLink,
  type TRPCLink,
} from "@trpc/react-query";
import { type AnyRouter } from "@trpc/server";
import { observable } from "@trpc/server/observable";
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
      // sentryLink<AppRouter>(),
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

export const sentryLink = <TRouter extends AnyRouter>(): TRPCLink<TRouter> => {
  return () => {
    return ({ next, op }) => {
      return observable((observer) => {
        const unsubscribe = next(op).subscribe({
          error(err) {
            captureException(err, (scope) => {
              scope.setFingerprint([err.message]);
              scope.setExtras({
                data: err.data,
                meta: err.meta,
                shape: err.shape,
              });
              return scope;
            });
            observer.error(err);
          },
        });
        return unsubscribe;
      });
    };
  };
};
