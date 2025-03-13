import { getLinks } from "@peated/server/trpc/links";
import { getQueryClient } from "@peated/server/trpc/query";
import { type AppRouter } from "@peated/server/trpc/router";
import config from "@peated/web/config";
import {
  createTRPCQueryUtils,
  type TRPCUntypedClient,
} from "@trpc/react-query";
import { type CreateQueryUtils } from "@trpc/react-query/shared";
import { cache } from "react";
import { getSession } from "../session.server";
import { trpc } from "./client";

export async function createTrpcClient(): Promise<CreateQueryUtils<AppRouter>> {
  const session = await getSession();
  const accessToken = session.accessToken;

  const client = trpc.createClient({
    links: getLinks({
      apiServer: config.API_SERVER,
      accessToken,
      batch: true,
      userAgent: "@peated/web (trpc)",
    }),
  });

  const queryClient = getQueryClient();
  const clientUtils = createTRPCQueryUtils({ queryClient, client });

  return clientUtils;
}

export const getTrpcClient = cache(createTrpcClient);

export async function getUnsafeTrpcClient(): Promise<
  TRPCUntypedClient<AppRouter>
> {
  const session = await getSession();
  const accessToken = session.accessToken;

  return trpc.createClient({
    links: getLinks({
      apiServer: config.API_SERVER,
      accessToken,
      batch: true,
      userAgent: "@peated/web (trpc/unsafe)",
    }),
  });
}
