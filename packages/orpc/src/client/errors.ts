import { isDefinedError, type ORPCError } from "@orpc/client";

export function isORPCClientError(
  error: unknown,
): error is ORPCError<any, any> {
  return isDefinedError(error);
}

export function isORPCNotFoundError(
  error: unknown,
): error is ORPCError<any, any> {
  return (
    isORPCClientError(error) &&
    (error.status === 404 || error.name === "NOT_FOUND")
  );
}

export function shouldCaptureORPCClientError(error: unknown): boolean {
  if (!isORPCClientError(error)) {
    return true;
  }

  return typeof error.status !== "number" || error.status >= 500;
}
