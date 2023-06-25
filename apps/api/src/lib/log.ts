import { captureException, captureMessage } from "@sentry/node";

export function logError(
  error: Error | unknown,
  context?: Record<string, any>,
): void;
export function logError(message: string, context?: Record<string, any>): void;
export function logError(
  error: string | Error | unknown,
  context?: Record<string, any>,
): void {
  if (typeof error === "string")
    captureMessage(error, {
      extra: context || undefined,
    });
  else
    captureException(error, {
      extra: context || undefined,
    });

  console.error(error);
}
