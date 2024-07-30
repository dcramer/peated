import { type AppRouter } from "@peated/server/trpc/router";
import { captureException } from "@sentry/core";
import {
  httpBatchLink,
  httpLink,
  loggerLink,
  type TRPCLink,
} from "@trpc/client";
import { type AnyRouter } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import SuperJSON from "superjson";

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
            const messageList: null | { code: "string"; message: "string" }[] =
              err.shape?.message instanceof Array ? err.shape.message : null;
            const code = err.shape?.data.code;
            const path = err.shape?.data.path;
            try {
              captureException(err, (scope) => {
                scope.setFingerprint(
                  messageList
                    ? [
                        code,
                        path,
                        ...Array.from(new Set(messageList.map((m) => m.code))),
                      ]
                    : [err.message],
                );
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

export function getLinks({
  apiServer,
  accessToken,
  batch = true,
}: {
  apiServer: string;
  accessToken?: string | null | undefined;
  batch: boolean;
}) {
  return [
    loggerLink({
      enabled: (opts) =>
        opts.direction === "down" && opts.result instanceof Error,
      colorMode: "ansi",
    }),
    sentryLink<AppRouter>(),
    (batch ? httpBatchLink : httpLink)({
      transformer: SuperJSON,
      url: `${apiServer}/trpc`,
      async headers() {
        return {
          authorization: accessToken ? `Bearer ${accessToken}` : "",
        };
      },
    }),
  ];
}
