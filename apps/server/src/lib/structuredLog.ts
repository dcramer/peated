import { logger } from "@sentry/node";

type StructuredLogAttributes = Record<
  string,
  string | number | boolean | string[] | number[]
>;

export function logInfo(message: string, attributes: StructuredLogAttributes) {
  logger.info(message, attributes);
}
