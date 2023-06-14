import { captureException, captureMessage } from "@sentry/node";

export function logError(error: Error, context?: Record<string, any>): void;
export function logError(message: string, context?: Record<string, any>): void;
export function logError(
  error: string | Error,
  context?: Record<string, any>,
): void {
  if (error instanceof Error)
    captureException(error, {
      extra: context || undefined,
    });
  else
    captureMessage(error, {
      extra: context || undefined,
    });
  console.error(error);
}
