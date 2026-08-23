import { isDefinedError, type ORPCError } from "@orpc/client";

type ClientErrorCandidate = Parameters<typeof isDefinedError>[0];

export function isORPCClientError(
  error: ClientErrorCandidate,
): error is ORPCError<any, any> {
  return isDefinedError(error);
}

export function isORPCNotFoundError(
  error: ClientErrorCandidate,
): error is ORPCError<any, any> {
  return (
    isORPCClientError(error) &&
    (error.status === 404 || error.name === "NOT_FOUND")
  );
}

export function shouldCaptureORPCClientError(
  error: ClientErrorCandidate,
): boolean {
  if (!isORPCClientError(error)) {
    return true;
  }

  const status = Number(error.status);
  return !Number.isFinite(status) || status >= 500;
}
