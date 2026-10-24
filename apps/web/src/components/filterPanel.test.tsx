// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FilterQuery } from "./filterPanel.stylex";

describe("FilterQuery", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onSubmit = vi.fn();

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    onSubmit.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(query: string) {
    act(() => {
      root.render(
        <FilterQuery
          label="Name"
          onSubmit={onSubmit}
          placeholder="Name"
          query={query}
        />,
      );
    });
  }

  function field() {
    const input = container.querySelector<HTMLInputElement>("input");
    if (!input) throw new Error("Missing query field");
    return input;
  }

  function type(value: string) {
    act(() => {
      // Use the native setter so React sees the change.
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(field(), value);
      field().dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  it("submits the typed query", () => {
    render("");
    type("  ardbeg ");
    act(() => {
      container
        .querySelector("form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });

    expect(onSubmit).toHaveBeenCalledWith("ardbeg");
  });

  it("shows the route query after it changes", () => {
    render("");
    type("ardbeg");
    render("ardbeg");
    expect(field().value).toBe("ardbeg");

    // Going back to the earlier URL must not bring back the old draft.
    render("");
    expect(field().value).toBe("");

    render("lagavulin");
    expect(field().value).toBe("lagavulin");
  });
});
