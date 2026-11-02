#! /usr/bin/env node

import "./sentry";

// import jobs
import "@peated/server/worker/jobs";

import { logError, logTelemetryError } from "@peated/server/lib/log";
import { Agent, setGlobalDispatcher } from "undici";
import { PeatedApiError } from "./api/client";
import "./commands";
import { ApiBatchRequestError, apiErrorResponse } from "./commands/api";
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
  // Sensitive-data rule (docs/policies/sensitive-data.md): the API's answer
  // can repeat request input, so it goes to this terminal only, not to
  // Sentry. Writing to the stream skips Sentry's console breadcrumbs.
  const failure = err instanceof ApiBatchRequestError ? err.cause : err;
  const response =
    failure instanceof PeatedApiError ? apiErrorResponse(failure) : null;
  if (response) process.stderr.write(`API response: ${response}\n`);
  process.exit(1);
});
