import { describe, expect, test } from "vitest";
import { formatLibraryTabLabel } from "./libraryTabLabel";

describe("formatLibraryTabLabel", () => {
  test.each([
    [{ open: 2, sealed: 3 }, "Library (2 open/3 sealed)"],
    [{ open: 2, sealed: 0 }, "Library (2 open)"],
    [{ open: 0, sealed: 3 }, "Library (3 sealed)"],
    [{ open: 0, sealed: 0 }, "Library"],
  ])("formats status counts", (counts, expected) => {
    expect(formatLibraryTabLabel(counts)).toBe(expected);
  });
});
