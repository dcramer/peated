import { sentryLink } from "@peated/server/src/lib/trpc";
import { type AppRouter } from "@peated/server/src/trpc/router";
import config from "@peated/web/config";
import { httpBatchLink } from "@trpc/client";
import { createTRPCQueryUtils } from "@trpc/react-query";
import getQueryClient from "./getQueryClient";
import { getSession } from "./session.server";
import { trpc } from "./trpc";

export async function getTrpcClient() {
  const session = await getSession();
  const accessToken = session.accessToken;

  const client = trpc.createClient({
    links: [
      sentryLink<AppRouter>(),
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

  const queryClient = getQueryClient();
  const clientUtils = createTRPCQueryUtils({ queryClient, client });

  return clientUtils;
}
