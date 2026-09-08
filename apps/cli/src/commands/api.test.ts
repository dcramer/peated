import { describe, expect, test } from "vitest";
import {
  ApiBatchRequestError,
  parseApiBatchConcurrency,
  parseApiBatchInput,
  parseApiBatchStartIndex,
  selectApiResult,
  verifyApiResult,
} from "./api";

describe("ApiBatchRequestError", () => {
  test("keeps the request index and original error", () => {
    const cause = new Error(
      'Response did not match status: expected "pending_review", received "approved".',
    );
    const error = new ApiBatchRequestError(
      8,
      "GET",
      "/prices/match-queue/123",
      cause,
    );

    expect(error).toMatchObject({
      message:
        'Request 8 failed (GET /prices/match-queue/123): Response did not match status: expected "pending_review", received "approved".',
      requestIndex: 8,
      requestMethod: "GET",
      requestPath: "/prices/match-queue/123",
      cause,
    });
  });
});

describe("parseApiBatchInput", () => {
  test("accepts ordered reads and mutations", () => {
    expect(
      parseApiBatchInput(
        JSON.stringify([
          { method: "GET", path: "/prices/match-queue/123" },
          {
            method: "POST",
            path: "/prices/match-queue/123/match",
            body: { proposal: 123, bottle: 456 },
            expect: {},
            select: ["id"],
          },
        ]),
      ),
    ).toEqual([
      { method: "GET", path: "/prices/match-queue/123" },
      {
        method: "POST",
        path: "/prices/match-queue/123/match",
        body: { proposal: 123, bottle: 456 },
        expect: {},
        select: ["id"],
      },
    ]);
  });

  test("rejects unsafe batches", () => {
    const inputs = [
      [],
      [{ method: "TRACE", path: "/version" }],
      [{ method: "GET", path: "https://example.com/version" }],
      [{ method: "GET", path: "//example.com/version" }],
    ];
    for (const input of inputs) {
      expect(() => parseApiBatchInput(JSON.stringify(input))).toThrow();
    }
  });
});

describe("selectApiResult", () => {
  test("selects nested object and array values", () => {
    expect(
      selectApiResult({ id: 1, bottle: { id: 2 }, distillers: [{ id: 3 }] }, [
        "id",
        "bottle.id",
        "distillers.0.id",
      ]),
    ).toEqual({ id: 1, "bottle.id": 2, "distillers.0.id": 3 });
  });

  test("rejects a missing result path", () => {
    expect(() => selectApiResult({ id: 1 }, ["bottle.id"])).toThrow(
      "Response does not contain bottle.id",
    );
  });
});

describe("verifyApiResult", () => {
  test("checks expected top-level fields", () => {
    expect(() =>
      verifyApiResult(
        { id: 123, status: "pending_review", extra: true },
        { id: 123, status: "pending_review" },
      ),
    ).not.toThrow();
  });

  test("rejects a stale preflight", () => {
    expect(() =>
      verifyApiResult(
        { id: 123, status: "approved" },
        { id: 123, status: "pending_review" },
      ),
    ).toThrow("Response did not match status");
  });
});

describe("parseApiBatchStartIndex", () => {
  test.each([
    [undefined, 0],
    ["0", 0],
    ["3", 3],
  ])("parses %j as %i", (value, expected) => {
    expect(parseApiBatchStartIndex(value, 4)).toBe(expected);
  });

  test.each(["-1", "4", "1.5", "nope"])("rejects %s", (value) => {
    expect(() => parseApiBatchStartIndex(value, 4)).toThrow();
  });
});

describe("parseApiBatchConcurrency", () => {
  test.each([
    [undefined, 1],
    ["1", 1],
    ["10", 10],
    ["20", 20],
  ])("parses %j as %i", (value, expected) => {
    expect(parseApiBatchConcurrency(value)).toBe(expected);
  });

  test.each(["0", "21", "1.5", "nope"])("rejects %s", (value) => {
    expect(() => parseApiBatchConcurrency(value)).toThrow();
  });
});
