// Web logging owns LogTape setup for Next server, edge, and browser runtimes.
// `logError` is the only facade method that creates Sentry issues.
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

const ROOT_LOG_CATEGORY = ["peated", "web"] as const;

type SinkId = "console" | "sentry";

let loggingConfigured = false;

export type LogContext = Record<string, unknown>;

export interface LogOptions {
  context?: unknown;
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

function safeJsonStringify(value: unknown): string | undefined {
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

function coerceMessage(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return value.toString();
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

  const consoleSink = redactByField(
    getConsoleSink({
      formatter: getJsonLinesFormatter(),
    }),
  ) as Sink;
  const sentrySink = redactByField(createSentryLogsSink()) as Sink;

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

function serializeError(value: unknown, depth = 0): SerializedError {
  if (value instanceof Error) {
    const serialized: SerializedError = {
      message: value.message,
    };

    if (value.name && value.name !== "Error") {
      serialized.name = value.name;
    }

    if (typeof value.stack === "string") {
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
function normalizeLogOptions(contextOrOptions?: unknown | LogOptions) {
  if (
    contextOrOptions &&
    typeof contextOrOptions === "object" &&
    ("context" in contextOrOptions || "extra" in contextOrOptions)
  ) {
    const options = contextOrOptions as LogOptions & LogContext;
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

function logWithLevel(
  level: LogLevel,
  value: unknown,
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
  value: unknown,
  contextOrOptions?: LogContext | LogOptions,
): void {
  logWithLevel("debug", value, contextOrOptions);
}

/** Emit an informational structured log without creating a Sentry issue. */
export function logInfo(
  value: unknown,
  contextOrOptions?: LogContext | LogOptions,
): void {
  logWithLevel("info", value, contextOrOptions);
}

/** Emit a warning structured log without creating a Sentry issue. */
export function logWarn(
  value: unknown,
  contextOrOptions?: LogContext | LogOptions,
): void {
  logWithLevel("warning", value, contextOrOptions);
}

/** Emit an error-level telemetry log without creating a Sentry issue. */
export function logTelemetryError(
  value: unknown,
  contextOrOptions?: LogContext | LogOptions,
): void {
  logWithLevel("error", value, contextOrOptions);
}

/** Capture an explicit Sentry issue and mirror it as a structured log. */
export function logError(error: Error | unknown, context?: unknown): void;
export function logError(message: string, context?: unknown): void;
export function logError(message: string, options?: LogOptions): void;
export function logError(
  error: string | Error | unknown,
  contextOrOptions?: unknown | LogOptions,
): string {
  configureLogging();

  const options = normalizeLogOptions(contextOrOptions);
  const eventId =
    typeof error === "string"
      ? Sentry.captureMessage(error, {
          level: "error",
          extra:
            options.context !== undefined || options.extra
              ? {
                  ...(options.extra ?? {}),
                  ...(options.context !== undefined
                    ? { context: options.context }
                    : {}),
                }
              : undefined,
        })
      : Sentry.captureException(error, {
          level: "error",
          extra:
            options.context !== undefined || options.extra
              ? {
                  ...(options.extra ?? {}),
                  ...(options.context !== undefined
                    ? { context: options.context }
                    : {}),
                }
              : undefined,
        });

  logWithLevel(
    "error",
    error,
    {
      ...options,
      extra: {
        ...(options.extra ?? {}),
        eventId,
      },
    },
    ["runtime", "issues"],
  );

  return eventId;
}
