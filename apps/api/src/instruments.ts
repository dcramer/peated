import * as Sentry from "@sentry/node";
import {
  SentrySpanProcessor,
  SentryPropagator,
} from "@sentry/opentelemetry-node";
import { ProfilingIntegration } from "@sentry/profiling-node";

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { prisma } from "./lib/db";

export const otelSdk = new NodeSDK({
  instrumentations: [getNodeAutoInstrumentations()],
  spanProcessor: new SentrySpanProcessor(),
  textMapPropagator: new SentryPropagator(),
});

otelSdk.start();

export const initSentry = ({ ...params }) => {
  Sentry.init({
    ...params,
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    instrumenter: "otel",
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Prisma({ client: prisma }),
      new ProfilingIntegration(),
      ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
    ],
  });
};
