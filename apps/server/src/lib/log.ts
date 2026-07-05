// Server logging owns LogTape setup, JSON console output, and Sentry Logs.
// `logError` is the only facade method that creates Sentry issues.
import { honoLogger } from "@logtape/hono";
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
import * as Sentry from "@sentry/node";
import { AsyncLocalStorage } from "node:async_hooks";

const DEFAULT_ROOT_LOG_CATEGORY = ["peated", "server"] as const;

type SinkId = "console" | "sentry";

const STDERR_CONSOLE_LEVEL_MAP = {
  trace: "error",
  debug: "error",
  info: "error",
  warning: "error",
  error: "error",
  fatal: "error",
} as const;

let loggingConfigured = false;
let rootLogCategory: readonly string[] = DEFAULT_ROOT_LOG_CATEGORY;

export type LogContext = Record<string, unknown>;
export type SentryLogContexts = Record<string, Record<string, unknown>>;
export type LogAttachments = Record<string, string | Uint8Array>;

export interface LogOptions {
  extra?: LogContext;
}

export interface LogIssueOptions extends LogOptions {
  attachments?: LogAttachments;
  contexts?: SentryLogContexts;
}

export interface LoggingConfig {
  rootCategory?: readonly string[];
}

function resolveLowestLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL;

  if (envLevel) {
    try {
      return parseLogLevel(envLevel);
    } catch {
      // Invalid LOG_LEVEL should not prevent startup.
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

/** Configure LogTape sinks for server, worker, and CLI runtimes. */
export function configureLogging(options: LoggingConfig = {}): void {
  if (loggingConfigured) {
    return;
  }

  rootLogCategory = options.rootCategory ?? DEFAULT_ROOT_LOG_CATEGORY;

  const consoleSink = redactByField(
    getConsoleSink({
      formatter: getJsonLinesFormatter(),
      levelMap: STDERR_CONSOLE_LEVEL_MAP,
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
        category: [...rootLogCategory],
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
    contextLocalStorage: new AsyncLocalStorage(),
  });

  loggingConfigured = true;
}

/** Create the HTTP request logger without exposing LogTape middleware details. */
export function httpLogger() {
  return honoLogger({
    category: [...rootLogCategory, "http"],
    context: true,
  });
}

function getLogger(
  scope: string | readonly string[],
  defaults?: LogContext,
): Logger {
  configureLogging();

  const category = Array.isArray(scope) ? scope : [scope];
  const logger = getLogTapeLogger([...rootLogCategory, ...category]);

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

  if (options.extra) {
    for (const [key, value] of Object.entries(options.extra)) {
      if (key !== "severity" && key !== "error") {
        properties[key] = value;
      }
    }
  }

  return properties;
}

function normalizeLogOptions(options?: LogOptions): LogOptions {
  return options ?? {};
}

function isLogIssueOptions(
  value: SentryLogContexts | LogIssueOptions | undefined,
): value is LogIssueOptions {
  return (
    value !== undefined &&
    ("contexts" in value || "extra" in value || "attachments" in value)
  );
}

// Normalize the legacy `contexts, attachments` signature and the options bag.
function normalizeIssueOptions(
  contextsOrOptions?: SentryLogContexts | LogIssueOptions,
  attachments?: LogAttachments,
): LogIssueOptions {
  const normalized = isLogIssueOptions(contextsOrOptions)
    ? contextsOrOptions
    : contextsOrOptions
      ? { contexts: contextsOrOptions }
      : {};

  return {
    ...normalized,
    attachments: isLogIssueOptions(contextsOrOptions)
      ? contextsOrOptions.attachments
      : attachments,
  };
}

function logWithLevel(
  level: LogLevel,
  value: unknown,
  options?: LogOptions,
  scope: string | readonly string[] = [],
): void {
  const normalizedOptions = normalizeLogOptions(options);
  const serializedError =
    value instanceof Error ? serializeError(value) : undefined;
  const message = serializedError
    ? serializedError.message
    : coerceMessage(value);
  const scopedLogger = getLogger(scope, {
    severity: level,
  });
  const properties = mergeLogProperties(
    level,
    normalizedOptions,
    serializedError,
  );

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
export function logDebug(value: unknown, options?: LogOptions): void {
  logWithLevel("debug", value, options);
}

/** Emit an informational structured log without creating a Sentry issue. */
export function logInfo(value: unknown, options?: LogOptions): void {
  logWithLevel("info", value, options);
}

/** Emit a warning structured log without creating a Sentry issue. */
export function logWarn(value: unknown, options?: LogOptions): void {
  logWithLevel("warning", value, options);
}

/** Emit an error-level telemetry log without creating a Sentry issue. */
export function logTelemetryError(value: unknown, options?: LogOptions): void {
  logWithLevel("error", value, options);
}

/** Capture an explicit Sentry issue and mirror it as a structured log. */
export function logError(
  error: Error | unknown,
  contexts?: SentryLogContexts,
  attachments?: LogAttachments,
): void;
export function logError(
  error: Error | unknown,
  options: LogIssueOptions,
): void;
export function logError(
  message: string,
  contexts?: SentryLogContexts,
  attachments?: LogAttachments,
): void;
export function logError(message: string, options: LogIssueOptions): void;
export function logError(
  error: string | Error | unknown,
  contexts?: SentryLogContexts | LogIssueOptions,
  attachments?: LogAttachments,
): string {
  configureLogging();

  const options = normalizeIssueOptions(contexts, attachments);

  const eventId = Sentry.withScope((scope) => {
    if (options.contexts) {
      for (const [key, context] of Object.entries(options.contexts)) {
        scope.setContext(key, context);
      }
    }

    if (options.extra) {
      scope.setContext("log", options.extra);
    }

    if (options.attachments) {
      for (const [key, data] of Object.entries(options.attachments)) {
        scope.addAttachment({
          data,
          filename: key,
        });
      }
    }

    return typeof error === "string"
      ? Sentry.captureMessage(error, {
          contexts: options.contexts,
          level: "error",
        })
      : Sentry.captureException(error, {
          contexts: options.contexts,
          level: "error",
        });
  });

  logWithLevel(
    "error",
    error,
    {
      extra: {
        ...(options.extra ?? {}),
        ...(options.contexts ? { sentryContexts: options.contexts } : {}),
        ...(options.attachments && Object.keys(options.attachments).length > 0
          ? { attachments: Object.keys(options.attachments) }
          : {}),
        eventId,
      },
    },
    ["runtime", "issues"],
  );

  return eventId;
}
