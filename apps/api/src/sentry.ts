import * as Sentry from "@sentry/node-experimental";
import { ProfilingIntegration } from "@sentry/profiling-node";
import config from "./config";

import packageData from "../package.json";

Sentry.init({
  dsn: config.SENTRY_DSN,
  release: config.VERSION,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  integrations: [new ProfilingIntegration()],
});

Sentry.setTag("service", packageData.name);
