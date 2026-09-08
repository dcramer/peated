// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  BottleRatingSummary,
  BottleRatings,
  ReviewScore,
  TastingRating,
} from "./scoring.stylex";

describe("Ratings", () => {
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

  it("puts the exact review median before its rating name", () => {
    act(() =>
      root.render(
        <BottleRatingSummary
          externalScoreCount={2}
          memberScoreCount={3}
          median={91}
          tastingCounts={{ outstanding: 2, unicorn: 1 }}
        />,
      ),
    );

    expect(container.textContent).toContain("Outstanding");
    expect(container.textContent).toContain("91");
    expect(container.textContent ?? "").toMatch(/91.*Outstanding/);
    expect(container.textContent).not.toContain("Bottle rating");
    expect(container.textContent).not.toContain("Tastings");
    expect(container.querySelector("section")?.getAttribute("aria-label")).toBe(
      "Bottle rating",
    );
    expect(container.querySelector('[role="img"]')).toBeNull();
  });

  it("uses the middle tasting rating without inventing an exact score", () => {
    act(() =>
      root.render(
        <BottleRatings
          raterCount={3}
          tastingCounts={{ outstanding: 1, unicorn: 1, very_good: 1 }}
        />,
      ),
    );

    expect(container.firstElementChild?.getAttribute("aria-label")).toContain(
      "Outstanding. Tasting rating range 90–94.",
    );
  });

  it("shows the rater count, right-aligned median, and exact score range", () => {
    act(() =>
      root.render(
        <BottleRatings
          maxScore={94}
          median={94}
          minScore={90}
          raterCount={24}
          scoreCount={31}
          tastingCounts={{ outstanding: 12 }}
        />,
      ),
    );

    expect(container.textContent ?? "").toMatch(/Outstanding.*24.*94.*90.*94/);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.firstElementChild?.getAttribute("aria-label")).toBe(
      "Outstanding. Median review score 94 out of 100. 24 raters. Ratings range from 90 to 94.",
    );
  });

  it("does not repeat a single exact score as a range", () => {
    act(() =>
      root.render(
        <BottleRatings
          maxScore={92}
          median={92}
          minScore={92}
          raterCount={1}
          scoreCount={1}
        />,
      ),
    );

    expect(container.textContent).toBe("Outstanding192");
    expect(container.firstElementChild?.getAttribute("aria-label")).toBe(
      "Outstanding. Median review score 92 out of 100. 1 rater.",
    );
  });

  it("uses the lower middle tasting rating when the count is even", () => {
    act(() =>
      root.render(
        <BottleRatings tastingCounts={{ outstanding: 1, unicorn: 1 }} />,
      ),
    );

    expect(container.firstElementChild?.getAttribute("aria-label")).toContain(
      "Outstanding. Tasting rating range 90–94.",
    );
  });

  it("omits a bottle rating when there is nothing to show", () => {
    act(() => root.render(<BottleRatings />));

    expect(container.innerHTML).toBe("");
  });

  it("shows a tasting's named rating and range instead of a five-point mark", () => {
    act(() => root.render(<TastingRating band="very_good" />));

    expect(container.textContent).toContain("Very good");
    expect(container.textContent).toContain("85–89 range");
    expect(container.querySelector('[role="img"]')).toBeNull();
  });

  it("names an exact review score on a 100-point scale", () => {
    act(() => root.render(<ReviewScore score={92} />));

    expect(container.textContent).toContain("Outstanding");
    expect(container.textContent).toContain("92/100");
  });

  it("keeps a critic's non-100 score without assigning a Peated rating", () => {
    act(() => root.render(<ReviewScore scale={10} score={8} />));

    expect(container.textContent).not.toContain("Good");
    expect(container.textContent).toContain("8/10");
  });
});
