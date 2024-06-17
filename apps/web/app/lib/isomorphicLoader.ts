import { makeTRPCClient } from "@peated/server/lib/trpc";
import { type AppRouter } from "@peated/server/src/trpc/router";
import { type User } from "@peated/server/types";
import config from "@peated/web/config";
import {
  type ClientLoaderFunction,
  type ClientLoaderFunctionArgs,
} from "@remix-run/react";
import {
  type LoaderFunction,
  type LoaderFunctionArgs,
} from "@remix-run/server-runtime";
import { captureException } from "@sentry/remix";
import { QueryClient } from "@tanstack/react-query";
import { createTRPCQueryUtils } from "@trpc/react-query";

export type IsomorphicContext = {
  request: LoaderFunctionArgs["request"] | ClientLoaderFunctionArgs["request"];
  params: LoaderFunctionArgs["params"] | ClientLoaderFunctionArgs["params"];
  context: {
    trpc: ReturnType<typeof makeTRPCClient>;
    queryClient: QueryClient;
    queryUtils: ReturnType<typeof createTRPCQueryUtils<AppRouter>>;
    user: User | null;
  };
  isServer: boolean;
};

type DataFunctionValue = Response | NonNullable<unknown> | null;

type DataCallback<T extends DataFunctionValue> = (
  context: IsomorphicContext,
) => Promise<T>;

/**
 * Builds a loader which gives access to a uniform context object, using DI to inject
 * identical interfaces which can be run against the client and server.
 *
 * ```
 * export const { loader, clientLoader } = makeIsomorphicLoader(async ({ params, context: { trpc }}) => {
 *  invariant(params.bottleId);
 *  const bottle = await trpc.bottleById.query(Number(params.bottleId));
 *  return { bottle };
 * });
 * ```
 */
export function makeIsomorphicLoader<T extends DataFunctionValue>(
  callback: DataCallback<T>,
) {
  return {
    loader: async function loader({
      request,
      params,
      context: { trpc, user },
    }) {
      const queryClient = new QueryClient();
      const queryUtils = createTRPCQueryUtils({
        queryClient,
        client: trpc,
      });

      const context: IsomorphicContext = {
        request,
        params,
        context: { trpc, user, queryUtils, queryClient },
        isServer: true,
      };
      return await callback(context);
    } satisfies LoaderFunction,
    clientLoader: async function clientLoader({ request, params }) {
      const trpcClient = makeTRPCClient(
        config.API_SERVER,
        window.REMIX_CONTEXT.accessToken,
        captureException,
      );

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            networkMode: "offlineFirst",
            // suspense: true,
            retry: false,
            // cacheTime: 0,
          },
        },
      });
      const queryUtils = createTRPCQueryUtils({
        queryClient,
        client: trpcClient,
      });

      const context: IsomorphicContext = {
        request,
        params,
        context: {
          trpc: trpcClient,
          user: window.REMIX_CONTEXT.user,
          queryClient,
          queryUtils,
        },
        isServer: false,
      };
      return await callback(context);
    } satisfies ClientLoaderFunction,
  };
}
