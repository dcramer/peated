// make sure to import this _before_ all other code
import "./sentry";

import { createAdaptorServer } from "@hono/node-server";
import type { AddressInfo } from "node:net";
import { app } from "./app";
import config from "./config";
import { logError, logInfo } from "./lib/log";
import { flushSentry } from "./sentry";

const getServerUrl = (address: AddressInfo | string | null) => {
  if (!address || typeof address === "string") {
    return `http://${config.HOST}:${config.PORT}/`;
  }

  const host =
    address.address === "::" || address.address === "0.0.0.0"
      ? "localhost"
      : address.address;

  return `http://${host}:${address.port}/`;
};

let exiting = false;

const exitWithError = async (message: string, err: unknown) => {
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
  void exitWithError("unhandledRejection received", err);
});

start();
