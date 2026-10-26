#! /usr/bin/env node

import "./sentry";

// import jobs
import "@peated/server/worker/jobs";

import { logError, logTelemetryError } from "@peated/server/lib/log";
import { Agent, setGlobalDispatcher } from "undici";
import "./commands";
import { ApiBatchRequestError } from "./commands/api";
import program from "./program";

// Some routes answer only when their work ends, such as an About dry run,
// which can take longer than fetch's default 5-minute wait.
setGlobalDispatcher(
  new Agent({ headersTimeout: 15 * 60_000, bodyTimeout: 15 * 60_000 }),
);

export { program };

program.parseAsync().catch((err) => {
  if (err instanceof ApiBatchRequestError) {
    logTelemetryError(err, {
      extra: {
        requestIndex: err.requestIndex,
        requestMethod: err.requestMethod,
        requestPath: err.requestPath,
      },
    });
  } else {
    logError(err);
  }
  process.exit(1);
});
