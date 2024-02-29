import {
  captureException,
  captureMessage,
  withScope,
} from "@sentry/node-experimental";

export function logError(
  error: Error | unknown,
  contexts?: Record<string, Record<string, any>>,
  attachments?: Record<string, string | Uint8Array>,
): void;
export function logError(
  message: string,
  contexts?: Record<string, Record<string, any>>,
  attachments?: Record<string, string | Uint8Array>,
): void;
export function logError(
  error: string | Error | unknown,
  contexts?: Record<string, Record<string, any>>,
  attachments?: Record<string, string | Uint8Array>,
): string {
  const level = "error";

  console.error(error);

  const eventId = withScope((scope) => {
    if (attachments) {
      for (const key in attachments) {
        scope.addAttachment({
          data: attachments[key],
          filename: key,
        });
      }
    }

    return typeof error === "string"
      ? captureMessage(error, {
          contexts,
          level,
        })
      : captureException(error, {
          contexts,
          level,
        });
  });

  return eventId;
}
