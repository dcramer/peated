// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NotePickerField, type NotePickerOption } from "./notePicker.stylex";

const notes: NotePickerOption[] = [
  { category: "Smoke", name: "Bonfire", usageCount: 12 },
  { category: "Fruit", name: "Apple", usageCount: 8 },
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
});
