// make sure to import this _before_ all other code
import "./sentry";

import { createAdaptorServer } from "@hono/node-server";
import * as Sentry from "@sentry/node";
import type { AddressInfo } from "node:net";
import { app } from "./app";
import config from "./config";

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

const exitWithError = (message: string, err: unknown) => {
  Sentry.captureException(err);
  console.error(`${message}: ${err}`, err);
  process.exit(1);
};

const start = () => {
  const server = createAdaptorServer({
    fetch: app.fetch,
    hostname: config.HOST,
  });

  server.on("error", (err) => {
    exitWithError("Server process received an error", err);
  });

  server.listen(config.PORT, config.HOST, () => {
    console.info(`API exposed at ${getServerUrl(server.address())}`);
  });
};

process.on("uncaughtException", (err) => {
  exitWithError("uncaughtException received", err);
});

process.on("unhandledRejection", (err) => {
  exitWithError("unhandledRejection received", err);
});

start();
