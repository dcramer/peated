// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BottleRatings, ReviewScore } from "./scoring.stylex";

describe("ReviewScore", () => {
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

  it("shows a score when there is one review", () => {
    act(() =>
      root.render(<ReviewScore count={1} high={92} low={92} median={92} />),
    );

    expect(container.textContent).toContain("92");
    expect(container.textContent).toContain("median of 1 score");
    expect(container.textContent).not.toContain("Only 1 score so far");
    expect(container.textContent).not.toContain("low 92");
  });

  it("omits Bottle ratings when there is nothing to show", () => {
    act(() => root.render(<BottleRatings />));

    expect(container.innerHTML).toBe("");
  });

  it("shows Bottle ratings when tasting ratings exist", () => {
    act(() => root.render(<BottleRatings counts={{ very_good: 2 }} />));

    expect(container.querySelector('[data-state="populated"]')).not.toBeNull();
  });
});
