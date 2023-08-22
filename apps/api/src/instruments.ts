import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";

export const initSentry = ({ ...params }) => {
  Sentry.init({
    ...params,
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    integrations: [
      new Sentry.Integrations.Postgres(),
      new Sentry.Integrations.Http({ tracing: true }),
      new ProfilingIntegration(),
      ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
    ],
  });
};
