// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ExpandableDescription,
  getDescriptionPreview,
} from "./expandableDescription.stylex";

describe("ExpandableDescription", () => {
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

  it("shows short descriptions without a disclosure", () => {
    act(() => root.render(<ExpandableDescription content="One sentence." />));

    expect(container.textContent?.trim()).toBe("One sentence.");
    expect(container.querySelector("button")).toBeNull();
  });

  it("uses the first two complete sentences for the preview", () => {
    expect(
      getDescriptionPreview(
        "First sentence. Second sentence with **detail**. Third sentence.",
      ),
    ).toEqual({
      text: "First sentence. Second sentence with detail.",
      truncated: true,
    });
  });

  it("expands and collapses the full description", () => {
    act(() =>
      root.render(
        <ExpandableDescription content="First sentence. Second sentence. Third sentence." />,
      ),
    );

    const button = container.querySelector("button");
    expect(container.textContent).toContain("First sentence. Second sentence.");
    expect(container.textContent).not.toContain("Third sentence.");
    expect(button?.textContent).toBe("Read more");
    expect(button?.getAttribute("aria-expanded")).toBe("false");

    act(() => button?.click());

    expect(container.textContent).toContain("Third sentence.");
    expect(button?.textContent).toBe("Show less");
    expect(button?.getAttribute("aria-expanded")).toBe("true");

    act(() => button?.click());

    expect(container.textContent).not.toContain("Third sentence.");
    expect(button?.textContent).toBe("Read more");
  });
});
