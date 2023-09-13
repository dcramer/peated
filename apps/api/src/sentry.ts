import config from "./config";

import { initSentry } from "./instruments";

initSentry({
  dsn: config.SENTRY_DSN,
  release: config.VERSION,
  debug: config.DEBUG,
});
