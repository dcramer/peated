import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";

import { prisma } from "./lib/db";

export const initSentry = ({ ...params }) => {
  Sentry.init({
    ...params,
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Prisma({ client: prisma }),
      new ProfilingIntegration(),
      ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
    ],
  });
};
