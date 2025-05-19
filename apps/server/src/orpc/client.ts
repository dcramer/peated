import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { type Router } from "@peated/server/orpc/router";

export function makeORPCClient(
  apiServer: string,
  accessToken?: string | null | undefined,
): RouterClient<Router> {
  const link = new RPCLink({
    url: `${apiServer}/rpc`,
    async headers() {
      return {
        authorization: accessToken ? `Bearer ${accessToken}` : "",
        "user-agent": "@peated (orpc/proxy)",
      };
    },
  });

  return createORPCClient(link);
}
