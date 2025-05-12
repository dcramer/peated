import config from "@peated/api/config";
import { makeTRPCClient } from "@peated/api/trpc/client";

export const trpcClient = makeTRPCClient(
  config.API_SERVER,
  process.env.ACCESS_TOKEN,
);
