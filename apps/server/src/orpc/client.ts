import { createORPCClient, isDefinedError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ORPCError, RouterClient } from "@orpc/server";
import { type Router } from "@peated/server/orpc/router";

export function makeORPCClient(
  apiServer: string,
  accessToken?: string | null | undefined,
): RouterClient<Router> {
  const link = new RPCLink({
    url: `${apiServer}/trpc`,
    async headers() {
      return {
        authorization: accessToken ? `Bearer ${accessToken}` : "",
        "user-agent": "@peated (trpc/proxy)",
      };
    },
  });

  return createORPCClient(link);
}

export function isORPCClientError(cause: unknown): cause is ORPCError {
  return isDefinedError(cause);
}
