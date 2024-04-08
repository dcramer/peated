import config from "@peated/server/config";
import { captureException } from "@sentry/node";
import { makeTRPCClient } from ".";

export const trpcClient = makeTRPCClient(
  config.API_SERVER,
  process.env.ACCESS_TOKEN,
  captureException,
);
