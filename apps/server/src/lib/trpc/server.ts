import config from "@peated/server/config";
import { makeTRPCClient } from "@peated/server/trpc/client";

export const trpcClient = makeTRPCClient(
  config.API_SERVER,
  process.env.ACCESS_TOKEN,
);
