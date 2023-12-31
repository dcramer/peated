import { captureException, captureMessage } from "@sentry/react";

export function logError(
  error: Error | unknown,
  context?: Record<string, any>,
): void;
export function logError(message: string, context?: Record<string, any>): void;
export function logError(
  error: string | Error | unknown,
  context?: Record<string, any>,
): string {
  console.error(error);

  const eventId =
    typeof error === "string"
      ? captureMessage(error, {
          extra: context || undefined,
        })
      : captureException(error, {
          extra: context || undefined,
        });

  return eventId;
}
