#! /usr/bin/env node

import "./sentry";

// import jobs
import "@peated/server/worker/jobs";

import { logError, logTelemetryError } from "@peated/server/lib/log";
import "./commands";
import { ApiBatchRequestError } from "./commands/api";
import program from "./program";

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
