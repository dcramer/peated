// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ApplicationHeader } from "./applicationHeader.stylex";

describe("ApplicationHeader", () => {
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

  it("opens mobile navigation as a modal and closes it", () => {
    act(() =>
      root.render(
        <ApplicationHeader
          action={<button type="button">Find a bottle</button>}
          currentHref="/bottles"
          databaseItems={[
            { href: "/activity", label: "Activity" },
            { href: "/bottles", label: "Bottles" },
          ]}
          personalItems={[{ href: "/library", label: "Library" }]}
        />,
      ),
    );

    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Open navigation"]',
        )
        ?.click();
    });

    const dialog = document.querySelector<HTMLElement>(
      '[role="dialog"][aria-label="Navigation menu"]',
    );
    expect(dialog).not.toBeNull();
    expect(
      dialog?.querySelector('nav[aria-label="Mobile navigation"]'),
    ).not.toBeNull();
    expect(dialog?.textContent).toContain("Library");

    act(() => {
      dialog
        ?.querySelector<HTMLButtonElement>(
          'button[aria-label="Close navigation"]',
        )
        ?.click();
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
