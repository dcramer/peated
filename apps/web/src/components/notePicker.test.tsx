// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NotePickerField, type NotePickerOption } from "./notePicker.stylex";

const notes: NotePickerOption[] = [
  { category: "Smoke", name: "Bonfire", usageCount: 12 },
  { category: "Fruit", name: "Apple", usageCount: 8 },
  {
    category: "Spice",
    name: "Black pepper",
    synonyms: ["peppery"],
    usageCount: 4,
  },
];

function NotePickerHarness() {
  const [value, setValue] = useState<readonly string[]>([]);
  return <NotePickerField notes={notes} onChange={setValue} value={value} />;
}

describe("NotePickerField", () => {
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

  it("opens the note browser as a modal panel and closes it", () => {
    act(() => root.render(<NotePickerHarness />));

    act(() => {
      container.querySelector<HTMLButtonElement>("button")?.click();
    });

    expect(
      document.querySelector(
        '[role="dialog"][aria-label="Browse tasting notes"]',
      ),
    ).not.toBeNull();
    expect(document.body.textContent).toContain("Bonfire");

    act(() => {
      document
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Close note picker"]',
        )
        ?.click();
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("names the field and browser for its review section", () => {
    act(() =>
      root.render(
        <NotePickerField
          label="Nose"
          notes={notes}
          onChange={() => undefined}
          value={[]}
        />,
      ),
    );

    expect(container.querySelector('input[aria-label="Nose"]')).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="Browse nose notes"]'),
    ).not.toBeNull();
  });

  it("suggests a note when the query matches one of its synonyms", () => {
    act(() => root.render(<NotePickerHarness />));
    const input = container.querySelector<HTMLInputElement>("input")!;
    act(() => {
      input.focus();
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(input, "peppery");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(container.querySelector('[role="option"]')?.textContent).toContain(
      "Black pepper",
    );
  });

  it("adds a suggested note from a tap that does not move focus", () => {
    act(() => root.render(<NotePickerHarness />));
    const input = container.querySelector<HTMLInputElement>("input")!;
    act(() => {
      input.focus();
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(input, "bon");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const option =
      container.querySelector<HTMLButtonElement>('[role="option"]')!;

    // Safari does not focus a tapped button, so the input blurs with no
    // new focus target unless the mousedown is cancelled.
    act(() => {
      const keepsFocus = !option.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
      );
      if (!keepsFocus) input.blur();
    });
    act(() => option.click());

    expect(
      container.querySelector('[aria-label="Remove Bonfire"]'),
    ).not.toBeNull();
  });
});
