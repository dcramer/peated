import config from "@peated/server/config";
import { makeORPCClient } from "@peated/server/orpc/client";

export const orpcClient = makeORPCClient(
  config.API_SERVER,
  process.env.ACCESS_TOKEN,
);
