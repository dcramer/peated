// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ImageViewer } from "./imageViewer.stylex";

describe("ImageViewer", () => {
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

  it("opens the full image and closes it again", () => {
    act(() =>
      root.render(
        <ImageViewer
          alt="Bottle label"
          label="bottle label"
          src="/label.jpg"
        />,
      ),
    );

    const trigger = container.querySelector("button");
    expect(trigger?.getAttribute("aria-label")).toBe(
      "View bottle label at full size",
    );

    act(() => trigger?.click());

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(
      document.querySelector<HTMLAnchorElement>('a[href="/label.jpg"]')
        ?.textContent,
    ).toContain("Open original");

    const close = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Close image viewer"]',
    );
    act(() => close?.click());

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
