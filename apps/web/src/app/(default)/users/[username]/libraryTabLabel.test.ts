import { describe, expect, test } from "vitest";
import { formatLibraryTabLabel } from "./libraryTabLabel";

describe("formatLibraryTabLabel", () => {
  test.each([
    [{ total: 5 }, "Library (5)"],
    [{ total: 0 }, "Library (0)"],
    [{ total: 1234 }, "Library (1,234)"],
  ])("formats the total bottle count", (counts, expected) => {
    expect(formatLibraryTabLabel(counts)).toBe(expected);
  });
});
