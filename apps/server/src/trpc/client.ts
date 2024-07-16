import { type AppRouter } from "@peated/server/trpc/router";
import { createTRPCProxyClient, TRPCClientError } from "@trpc/client";
import { getLinks } from "./links";

export function makeTRPCClient(
  apiServer: string,
  accessToken?: string | null | undefined,
) {
  return createTRPCProxyClient<AppRouter>({
    links: getLinks({
      apiServer,
      accessToken,
      batch: false,
    }),
  });
}

export function isTRPCClientError(
  cause: unknown,
): cause is TRPCClientError<AppRouter> {
  return (
    cause instanceof TRPCClientError || Object.hasOwn(cause as any, "data")
  );
}
