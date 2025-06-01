import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import sentryInterceptor from "@peated/orpc/client/interceptors";
import type { Router } from "@peated/server/orpc/router";

export function createClient(
  apiServer: string,
  accessToken?: string | null | undefined
): RouterClient<Router> {
  const link = new RPCLink({
    url: `${apiServer}/rpc`,
    async headers() {
      return {
        authorization: accessToken ? `Bearer ${accessToken}` : "",
        "user-agent": "@peated (orpc/proxy)",
      };
    },
    interceptors: [sentryInterceptor({ captureInputs: true })],
  });

  return createORPCClient(link);
}
