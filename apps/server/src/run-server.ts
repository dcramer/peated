// make sure to import this _before_ all other code
import "./sentry";

import { serve } from "@hono/node-server";
import * as Sentry from "@sentry/node";
import { app } from "./app";
import config from "./config";

const start = async () => {
  try {
    console.info(`API exposed at http://${config.HOST}:${config.PORT}/`);

    serve({
      fetch: app.fetch,
      port: config.PORT as number,
      hostname: config.HOST,
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error(`Server process received an error: ${err}`, err);
    process.exit(1);
  }
};

process.on("uncaughtException", (err) => {
  console.error(`uncaughtException received: ${err}`, err);
});

start();
