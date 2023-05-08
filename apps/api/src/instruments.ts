import * as Sentry from "@sentry/node";
import {
  SentrySpanProcessor,
  SentryPropagator,
} from "@sentry/opentelemetry-node";

import { NodeSDK } from "@opentelemetry/sdk-node";
import otelApi from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { prisma } from "./lib/db";

export const otelSdk = new NodeSDK({
  // Existing config
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()],

  // Sentry config
  spanProcessor: new SentrySpanProcessor(),
  textMapPropagator: new SentryPropagator(),
});

otelSdk.start();

export const initSentry = ({ ...params }) => {
  Sentry.init({
    ...params,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Prisma({ client: prisma }),
      ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
    ],
    tracesSampleRate: 1.0,
  });
};
