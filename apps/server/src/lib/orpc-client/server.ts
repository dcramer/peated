import config from "@peated/server/config";
import { createClient } from "@peated/server/orpc/client";

export const orpcClient = createClient(
  config.API_SERVER,
  process.env.ACCESS_TOKEN,
);
