/**
 * Web logging boundary for Next server, edge, and browser runtimes.
 *
 * This module owns LogTape setup and the Sentry adapter. `logError` is the only
 * facade method that creates Sentry issues; the other level helpers emit
 * diagnostic telemetry without issue capture. Callers own selecting safe
 * structured context under `docs/policies/observability.md` and
 * `docs/policies/data-redaction.md`.
 */
import {
  configureSync,
  getConfig,
  getConsoleSink,
  getJsonLinesFormatter,
  getLogger as getLogTapeLogger,
  parseLogLevel,
  type Logger,
  type LogLevel,
  type LogRecord,
  type Sink,
} from "@logtape/logtape";
import { redactByField } from "@logtape/redaction";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

const ROOT_LOG_CATEGORY = ["peated", "web"] as const;

type SinkId = "console" | "sentry";

let loggingConfigured = false;

export type LogContext = LogRecord["properties"];
type LogContextValue = LogContext[string];
type LogMessage = LogRecord["message"][number];

export interface LogOptions {
  context?: LogContextValue;
  extra?: LogContext;
}

function resolveLowestLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL;

  if (envLevel) {
    try {
      return parseLogLevel(envLevel);
    } catch {
      // Invalid LOG_LEVEL should not prevent rendering.
    }
  }

  return process.env.NODE_ENV === "development" ? "debug" : "info";
}

function safeJsonStringify(value: LogMessage): string | undefined {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function truncate(text: string, maxLength = 1024): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

function coerceMessage(value: LogMessage): string {
  const text = z.string().safeParse(value);
  if (text.success) {
    return text.data;
  }

  const primitive = z
    .union([z.number(), z.boolean(), z.bigint()])
    .safeParse(value);
  if (primitive.success) {
    return primitive.data.toString();
  }

  if (value === null || value === undefined) {
    return String(value);
  }

  const json = safeJsonStringify(value);
  if (json) {
    return truncate(json);
  }

  return Object.prototype.toString.call(value);
}

function getRecordMessage(record: LogRecord): string {
  return record.message.map(coerceMessage).join("");
}

function createSentryLogsSink(): Sink {
  return (record) => {
    const attributes = {
      ...record.properties,
      logger: record.category.join("."),
    };
    const message = getRecordMessage(record);

    switch (record.level) {
      case "trace":
        Sentry.logger.trace(message, attributes);
        break;
      case "debug":
        Sentry.logger.debug(message, attributes);
        break;
      case "info":
        Sentry.logger.info(message, attributes);
        break;
      case "warning":
        Sentry.logger.warn(message, attributes);
        break;
      case "error":
        Sentry.logger.error(message, attributes);
        break;
      case "fatal":
        Sentry.logger.fatal(message, attributes);
        break;
    }
  };
}

/** Configure LogTape sinks for Next server, edge, and browser runtimes. */
export function configureLogging(): void {
  if (loggingConfigured) {
    return;
  }

  const consoleSink: Sink = redactByField(
    getConsoleSink({
      formatter: getJsonLinesFormatter(),
    }),
  );
  const sentrySink: Sink = redactByField(createSentryLogsSink());

  configureSync<SinkId, never>({
    reset: getConfig() !== null,
    sinks: {
      console: consoleSink,
      sentry: sentrySink,
    },
    loggers: [
      {
        category: [...ROOT_LOG_CATEGORY],
        sinks: ["console", "sentry"],
        lowestLevel: resolveLowestLevel(),
      },
      {
        category: ["logtape", "meta"],
        sinks: ["console"],
        lowestLevel: "warning",
      },
      {
        category: "logtape",
        sinks: ["console"],
        lowestLevel: "error",
      },
    ],
  });

  loggingConfigured = true;
}

function getLogger(
  scope: string | readonly string[],
  defaults?: LogContext,
): Logger {
  configureLogging();

  const category = Array.isArray(scope) ? scope : [scope];
  const logger = getLogTapeLogger([...ROOT_LOG_CATEGORY, ...category]);

  return defaults ? logger.with(defaults) : logger;
}

interface SerializedError {
  message: string;
  name?: string;
  stack?: string;
  cause?: SerializedError;
}

function serializeError(value: LogMessage, depth = 0): SerializedError {
  if (value instanceof Error) {
    const serialized: SerializedError = {
      message: value.message,
    };

    if (value.name && value.name !== "Error") {
      serialized.name = value.name;
    }

    if (value.stack !== undefined) {
      serialized.stack = value.stack;
    }

    if ("cause" in value && value.cause !== undefined && depth < 3) {
      serialized.cause = serializeError(value.cause, depth + 1);
    }

    return serialized;
  }

  return { message: coerceMessage(value) };
}

// Keep existing context-argument callers working while accepting structured
// `{context, extra}` options for new LogTape attributes.
function normalizeLogOptions(contextOrOptions?: LogContextValue | LogOptions) {
  const structuredOptions = z
    .object({
      context: z.string().optional(),
      extra: z.record(z.string(), z.unknown()).optional(),
    })
    .passthrough()
    .safeParse(contextOrOptions);
  if (
    structuredOptions.success &&
    (structuredOptions.data.context !== undefined ||
      structuredOptions.data.extra !== undefined)
  ) {
    const options = structuredOptions.data;
    const extra: LogContext = { ...(options.extra ?? {}) };

    for (const [key, value] of Object.entries(options)) {
      if (key !== "context" && key !== "extra") {
        extra[key] = value;
      }
    }

    return {
      context: options.context,
      extra: Object.keys(extra).length > 0 ? extra : options.extra,
    };
  }

  return contextOrOptions ? { context: contextOrOptions } : {};
}

function mergeLogProperties(
  level: LogLevel,
  options: LogOptions,
  serializedError?: SerializedError,
): LogContext {
  const properties: LogContext = {
    severity: level,
  };

  if (serializedError) {
    properties.error = serializedError;
  }

  if (options.context !== undefined) {
    properties.context = options.context;
  }

  if (options.extra) {
    for (const [key, value] of Object.entries(options.extra)) {
      if (key !== "severity" && key !== "error" && key !== "context") {
        properties[key] = value;
      }
    }
  }

  return properties;
}

function buildSentryExtra(options: LogOptions): LogContext | undefined {
  if (options.context === undefined && !options.extra) return undefined;
  const extra: LogContext = { ...(options.extra ?? {}) };
  if (options.context !== undefined) extra.context = options.context;
  return extra;
}

function logWithLevel(
  level: LogLevel,
  value: LogMessage,
  contextOrOptions?: LogContext | LogOptions,
  scope: string | readonly string[] = [],
): void {
  const options = normalizeLogOptions(contextOrOptions);
  const serializedError =
    value instanceof Error ? serializeError(value) : undefined;
  const message = serializedError
    ? serializedError.message
    : coerceMessage(value);
  const scopedLogger = getLogger(scope, {
    severity: level,
  });
  const properties = mergeLogProperties(level, options, serializedError);

  switch (level) {
    case "trace":
      scopedLogger.trace(message, () => properties);
      break;
    case "debug":
      scopedLogger.debug(message, () => properties);
      break;
    case "info":
      scopedLogger.info(message, () => properties);
      break;
    case "warning":
      scopedLogger.warn(message, () => properties);
      break;
    case "error":
      scopedLogger.error(message, () => properties);
      break;
    case "fatal":
      scopedLogger.fatal(message, () => properties);
      break;
  }
}

/** Emit a debug structured log without creating a Sentry issue. */
export function logDebug(
  value: LogMessage,
  contextOrOptions?: LogContext | LogOptions,
): void {
  logWithLevel("debug", value, contextOrOptions);
}

/** Emit an informational structured log without creating a Sentry issue. */
export function logInfo(
  value: LogMessage,
  contextOrOptions?: LogContext | LogOptions,
): void {
  logWithLevel("info", value, contextOrOptions);
}

/** Emit a warning structured log without creating a Sentry issue. */
export function logWarn(
  value: LogMessage,
  contextOrOptions?: LogContext | LogOptions,
): void {
  logWithLevel("warning", value, contextOrOptions);
}

/** Emit an error-level telemetry log without creating a Sentry issue. */
export function logTelemetryError(
  value: LogMessage,
  contextOrOptions?: LogContext | LogOptions,
): void {
  logWithLevel("error", value, contextOrOptions);
}

/** Capture an explicit Sentry issue and mirror it as a structured log. */
export function logError(
  error: Error | LogMessage,
  context?: LogContextValue,
): void;
export function logError(message: string, context?: LogContextValue): void;
export function logError(message: string, options?: LogOptions): void;
export function logError(
  error: string | Error | LogMessage,
  contextOrOptions?: LogContextValue | LogOptions,
): string {
  configureLogging();

  const options = normalizeLogOptions(contextOrOptions);
  const sentryExtra = buildSentryExtra(options);
  const message = z.string().safeParse(error);
  const eventId = message.success
    ? Sentry.captureMessage(message.data, {
        level: "error",
        extra: sentryExtra,
      })
    : Sentry.captureException(error, {
        level: "error",
        extra: sentryExtra,
      });

  const logExtra: LogContext = { ...(options.extra ?? {}) };
  logExtra.eventId = eventId;

  logWithLevel(
    "error",
    error,
    {
      ...options,
      extra: logExtra,
    },
    ["runtime", "issues"],
  );

  return eventId;
}
