import { logger } from "@sentry/node";
import config from "../config";

type StructuredLogAttributes = Record<
  string,
  string | number | boolean | string[] | number[]
>;

export function logInfo(message: string, attributes: StructuredLogAttributes) {
  if (config.ENV === "development") {
    console.info(`[structured] ${message}`, attributes);
  }

  logger.info(message, attributes);
}
