import { describe, expect, it } from "vitest";

import { getHomeSearchPlaceholder } from "./homeSearchPlaceholder";

describe("getHomeSearchPlaceholder", () => {
  it("uses the supplied random value to select a hint", () => {
    expect(getHomeSearchPlaceholder(() => 0)).toBe("Try “Lagavulin 16”…");
    expect(getHomeSearchPlaceholder(() => 0.999)).toBe(
      "Try a bottle, distiller, brand, or bottler…",
    );
  });
});
