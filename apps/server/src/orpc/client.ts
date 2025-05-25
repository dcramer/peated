import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { type Router } from "@peated/server/orpc/router";
import { logError } from "../lib/log";

export function createClient(
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
    interceptors: [
      async ({ next, path }) => {
        console.log("RPC call", path);
        if (path[0] === "then") throw new Error("then is not a valid path");
        try {
          return await next();
        } catch (error) {
          logError(error);
          throw error;
        }
      },
    ],
  });

  return createORPCClient(link);
}
