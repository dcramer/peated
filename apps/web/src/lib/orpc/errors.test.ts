import { shouldCaptureORPCClientError } from "@peated/orpc/client/errors";
import { expect, test } from "vitest";

test("does not capture an aborted request", () => {
  expect(
    shouldCaptureORPCClientError(
      new DOMException("The request was cancelled.", "AbortError"),
    ),
  ).toBe(false);
});

test("captures an unexpected client failure", () => {
  expect(shouldCaptureORPCClientError(new Error("Request failed."))).toBe(true);
});
