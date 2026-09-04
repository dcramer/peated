// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BottleRatingSummary, BottleRatings } from "./scoring.stylex";

describe("Bottle ratings", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("keeps the rating name aligned with the exact review median", () => {
    act(() =>
      root.render(
        <BottleRatingSummary
          externalScoreCount={2}
          memberScoreCount={3}
          median={91}
          reviewCounts={{ outstanding: 4, very_good: 1 }}
          tastingCounts={{ outstanding: 2, unicorn: 1 }}
        />,
      ),
    );

    expect(container.textContent).toContain("Outstanding");
    expect(container.textContent).toContain("91");
    expect(container.textContent).toContain("Member reviews");
    expect(container.textContent).toContain("Critic reviews");
    expect(container.textContent).toContain("Tastings");
    expect(container.textContent).not.toContain("3 member reviews");
    expect(
      container.querySelector('[role="img"]')?.getAttribute("aria-label"),
    ).toContain("Outstanding 6");
  });

  it("uses the middle tasting rating without inventing an exact score", () => {
    act(() =>
      root.render(
        <BottleRatings
          tastingCounts={{ outstanding: 1, unicorn: 1, very_good: 1 }}
        />,
      ),
    );

    expect(container.firstElementChild?.getAttribute("aria-label")).toContain(
      "Outstanding, 90–94 range",
    );
  });

  it("uses the lower middle tasting rating when the count is even", () => {
    act(() =>
      root.render(
        <BottleRatings tastingCounts={{ outstanding: 1, unicorn: 1 }} />,
      ),
    );

    expect(container.firstElementChild?.getAttribute("aria-label")).toContain(
      "Outstanding, 90–94 range",
    );
  });

  it("omits a bottle rating when there is nothing to show", () => {
    act(() => root.render(<BottleRatings />));

    expect(container.innerHTML).toBe("");
  });
});
