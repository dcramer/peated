// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FacetGroup, FilterQuery } from "./filterPanel.stylex";

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

describe("FacetGroup", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onChange = vi.fn();

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    onChange.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(required: boolean) {
    act(() => {
      root.render(
        <FacetGroup
          label="Show"
          onChange={onChange}
          options={[
            { label: "Distillery releases", value: "releases" },
            { label: "Other bottlings", value: "other" },
          ]}
          required={required}
          selected="releases"
        />,
      );
    });
  }

  function getButton(name: string) {
    const button = [...container.querySelectorAll("button")].find((element) =>
      element.textContent?.includes(name),
    );
    if (!button) throw new Error(`Missing ${name}`);
    return button;
  }

  it("clears a selected option when it is chosen again", () => {
    render(false);

    act(() => getButton("Distillery releases").click());

    expect(onChange).toHaveBeenCalledWith("");
    expect(getButton("Distillery releases").textContent).toContain("×");
  });

  it("keeps a required option selected", () => {
    render(true);

    act(() => getButton("Distillery releases").click());
    act(() => getButton("Other bottlings").click());

    expect(onChange.mock.calls).toEqual([["other"]]);
    expect(getButton("Distillery releases").textContent).not.toContain("×");
  });
});
