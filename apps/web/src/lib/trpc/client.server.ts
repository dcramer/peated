import { getLinks } from "@peated/server/trpc/links";
import { getQueryClient } from "@peated/server/trpc/query";
import { type AppRouter } from "@peated/server/trpc/router";
import config from "@peated/web/config";
import { createTRPCQueryUtils } from "@trpc/react-query";
import { type CreateQueryUtils } from "@trpc/react-query/shared";
import { getSession } from "../session.server";
import { trpc } from "./client";

export async function getTrpcClient(): Promise<CreateQueryUtils<AppRouter>> {
  const session = await getSession();
  const accessToken = session.accessToken;

  const client = trpc.createClient({
    links: getLinks({
      apiServer: config.API_SERVER,
      accessToken,
      batch: true,
    }),
  });

  const queryClient = getQueryClient();
  const clientUtils = createTRPCQueryUtils({ queryClient, client });

  return clientUtils;
}
