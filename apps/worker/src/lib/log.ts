import { captureException, captureMessage } from "@sentry/node-experimental";

export function logError(
  error: Error | unknown,
  contexts?: Record<string, Record<string, any>>,
): void;
export function logError(
  message: string,
  contexts?: Record<string, Record<string, any>>,
): void;
export function logError(
  error: string | Error | unknown,
  contexts?: Record<string, Record<string, any>>,
): void {
  if (typeof error === "string")
    captureMessage(error, {
      contexts,
    });
  else
    captureException(error, {
      contexts,
    });

  console.error(error);
}
