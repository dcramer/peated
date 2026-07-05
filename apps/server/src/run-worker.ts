// make sure to import this _before_ all other code
import "./sentry";

import { logError } from "./lib/log";
import { runWorker } from "./worker/client";

runWorker().catch((e) => {
  logError(e, {
    extra: {
      message: "Worker crashed",
    },
  });
});
