// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchSelect, type SearchPickerOption } from "./searchPicker.stylex";

const options: SearchPickerOption[] = [
  { id: 1, label: "Lagavulin" },
  { id: 2, label: "Laphroaig" },
];

function PickerHarness({
  loading = false,
  searchError,
}: {
  loading?: boolean;
  searchError?: string;
}) {
  const [value, setValue] = useState<SearchPickerOption | null>(null);
  return (
    <SearchSelect
      label="Brand"
      loading={loading}
      onChange={setValue}
      options={options}
      placeholder="Search brands"
      searchError={searchError}
      value={value}
    />
  );
}

describe("SearchSelect", () => {
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

  it("selects and clears a value with keyboard-accessible controls", () => {
    act(() => root.render(<PickerHarness />));
    const input = container.querySelector<HTMLInputElement>("input")!;

    act(() => {
      input.focus();
      input.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }),
      );
    });
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
      );
    });

    expect(container.textContent).toContain("Lagavulin");
    const clear = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Clear Lagavulin"]',
    );
    expect(clear?.tabIndex).toBe(0);
    act(() => clear?.click());
    expect(container.querySelector<HTMLInputElement>("input")).not.toBeNull();
  });

  it("shows the same loading and remote failure states without changing value", () => {
    act(() => root.render(<PickerHarness loading />));
    act(() => container.querySelector<HTMLInputElement>("input")?.focus());
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Searching",
    );

    act(() =>
      root.render(
        <PickerHarness searchError="Unable to search brands. Try again." />,
      ),
    );
    act(() => container.querySelector<HTMLInputElement>("input")?.focus());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Unable to search brands",
    );
  });

  it("ignores results that do not match the current input text", () => {
    const onChange = vi.fn();
    act(() =>
      root.render(
        <SearchSelect
          label="Brand"
          onChange={onChange}
          options={options}
          placeholder="Search brands"
          value={null}
        />,
      ),
    );
    const input = container.querySelector<HTMLInputElement>("input")!;
    act(() => {
      const valueDescriptor = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      );
      valueDescriptor?.set?.call(input, "Yamazaki");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });
});
