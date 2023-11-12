import { type AppRouter } from "@peated/server/trpc/router";
import { type captureException } from "@sentry/core";
import {
  createTRPCProxyClient,
  httpBatchLink,
  type TRPCLink,
} from "@trpc/client";
import { type AnyRouter } from "@trpc/server";
import { observable } from "@trpc/server/observable";

type AnySentryCaptureException = typeof captureException;

export function makeTRPCClient<
  SentryCaptureException extends AnySentryCaptureException,
>(
  apiServer: string,
  accessToken?: string | null | undefined,
  captureException?: SentryCaptureException,
) {
  return createTRPCProxyClient<AppRouter>({
    links: [
      ...(captureException ? [sentryLink<AppRouter>(captureException)] : []),
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

export function sentryLink<TRouter extends AnyRouter>(
  captureException: AnySentryCaptureException,
): TRPCLink<TRouter> {
  return () => {
    return ({ next, op }) => {
      return observable((observer) => {
        // defn: unsubscribe
        return next(op).subscribe({
          next(value) {
            observer.next(value);
          },
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
          complete() {
            observer.complete();
          },
        });
      });
    };
  };
}
