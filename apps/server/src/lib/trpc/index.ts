import { type AppRouter } from "@peated/server/trpc/router";
import { captureException } from "@sentry/core";
import {
  createTRPCProxyClient,
  httpBatchLink,
  type TRPCLink,
} from "@trpc/client";
import { type AnyRouter } from "@trpc/server";
import { observable } from "@trpc/server/observable";

export function makeTRPCClient(
  apiServer: string,
  accessToken?: string | null | undefined,
) {
  return createTRPCProxyClient<AppRouter>({
    links: [
      sentryLink<AppRouter>(),
      httpBatchLink({
        url: `${apiServer}/trpc`,
        async headers() {
          return {
            authorization: accessToken ? `Bearer ${accessToken}` : "",
          };
        },
      }),
    ],
  });
}

export function sentryLink<TRouter extends AnyRouter>(): TRPCLink<TRouter> {
  return () => {
    return ({ next, op }) => {
      return observable((observer) => {
        // defn: unsubscribe
        return next(op).subscribe({
          next(value) {
            observer.next(value);
          },
          error(err) {
            try {
              captureException(err, (scope) => {
                scope.setFingerprint([err.message]);
                scope.setExtras({
                  data: err.data,
                  meta: err.meta,
                  shape: err.shape,
                });
                return scope;
              });
            } catch (err) {
              console.error(err);
            }
            observer.error(err);
          },
          complete() {
            observer.complete();
          },
        });
      });
    };
  };
}
