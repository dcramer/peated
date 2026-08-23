// make sure to import this _before_ all other code
import "./sentry";

import { createAdaptorServer } from "@hono/node-server";
import type { AddressInfo } from "node:net";
import { z } from "zod";
import { app } from "./app";
import config from "./config";
import { logError, logInfo } from "./lib/log";
import { flushSentry } from "./sentry";

const AddressInfoSchema = z.object({
  address: z.string(),
  port: z.number().int(),
});

const getServerUrl = (address: AddressInfo | string | null) => {
  if (!address || z.string().safeParse(address).success) {
    return `http://${config.HOST}:${config.PORT}/`;
  }
  const networkAddress = AddressInfoSchema.parse(address);

  const host =
    networkAddress.address === "::" || networkAddress.address === "0.0.0.0"
      ? "localhost"
      : networkAddress.address;

  return `http://${host}:${networkAddress.port}/`;
};

let exiting = false;

const exitWithError = async (message: string, err: Error) => {
  if (exiting) return;
  exiting = true;

  logError(err, {
    extra: {
      message,
    },
  });

  try {
    await flushSentry(2000);
  } finally {
    process.exit(1);
  }
};

const start = () => {
  const server = createAdaptorServer({
    fetch: app.fetch,
    hostname: config.HOST,
  });

  server.on("error", (err) => {
    void exitWithError("Server process received an error", err);
  });

  server.listen(config.PORT, config.HOST, () => {
    logInfo("API exposed at {url}", {
      extra: {
        url: getServerUrl(server.address()),
      },
    });
  });
};

process.on("uncaughtException", (err) => {
  void exitWithError("uncaughtException received", err);
});

process.on("unhandledRejection", (err) => {
  const error =
    err instanceof Error
      ? err
      : new Error("Unhandled rejection did not provide an Error.", {
          cause: err,
        });
  void exitWithError("unhandledRejection received", error);
});

start();
