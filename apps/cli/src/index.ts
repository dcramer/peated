#! /usr/bin/env node

import "./sentry";

// import jobs
import "@peated/server/worker/jobs";

import { logError } from "@peated/server/lib/log";
import "./commands";
import program from "./program";

export { program };

program.parseAsync().catch((err) => {
  logError(err);
  process.exit(1);
});
