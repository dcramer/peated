// make sure to import this _before_ all other code
import "./sentry";

import * as Sentry from "@sentry/node";
import { runWorker } from "./worker/client";

if (typeof require !== "undefined" && require.main === module) {
  runWorker().catch((e) => {
    Sentry.captureException(e);
    console.error("Worker crashed", e);
  });
}
