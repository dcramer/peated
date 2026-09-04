import { describe, expect, test } from "vitest";
import { parsePreviewLimit } from "./scrapers";

describe("parsePreviewLimit", () => {
  test("accepts a bounded whole number", () => {
    expect(parsePreviewLimit("3")).toBe(3);
  });

  test.each(["0", "100", "1.5", "nope"])("rejects %s", (value) => {
    expect(() => parsePreviewLimit(value)).toThrow(
      "Preview limit must be an integer from 1 to 99.",
    );
  });
});
