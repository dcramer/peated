import { describe, expect, it } from "vitest";

import { getTextTitle } from "./textTitle";

describe("getTextTitle", () => {
  it("extracts text from fragments and ignores non-text components", () => {
    expect(
      getTextTitle(
        <>
          Highland <span>peaty potion</span>
          <span aria-hidden="true" />
        </>,
      ),
    ).toBe("Highland peaty potion");
  });

  it("returns undefined without visible text", () => {
    expect(getTextTitle(<span aria-hidden="true" />)).toBeUndefined();
  });
});
