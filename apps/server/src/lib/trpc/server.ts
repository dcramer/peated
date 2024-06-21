import config from "@peated/server/config";
import { makeTRPCClient } from ".";

export const trpcClient = makeTRPCClient(
  config.API_SERVER,
  process.env.ACCESS_TOKEN,
);
