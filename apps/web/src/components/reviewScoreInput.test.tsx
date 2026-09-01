// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ReviewScoreInput } from "./tastingInputs.stylex";

function ReviewScoreHarness({ initialValue }: { initialValue: number | null }) {
  const [value, setValue] = useState(initialValue);

  return (
    <ReviewScoreInput
      id="score"
      name="score"
      onChange={setValue}
      required
      value={value}
    />
  );
}

describe("ReviewScoreInput", () => {
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

  it("changes the score one point at a time and updates its rating range", () => {
    act(() => root.render(<ReviewScoreHarness initialValue={89} />));

    expect(container.textContent).toContain("Very good");
    expect(container.textContent).toContain("85–89");

    const increase = container.querySelector<HTMLButtonElement>(
      'button[aria-label="One point higher"]',
    );
    act(() => increase?.click());

    expect(container.querySelector<HTMLInputElement>("#score")?.value).toBe(
      "90",
    );
    expect(container.textContent).toContain("Outstanding");
    expect(container.textContent).toContain("90–94");
  });

  it("starts an empty score at 85 and stays within the 0–100 range", () => {
    act(() => root.render(<ReviewScoreHarness initialValue={null} />));

    const increase = container.querySelector<HTMLButtonElement>(
      'button[aria-label="One point higher"]',
    );
    act(() => increase?.click());

    expect(container.querySelector<HTMLInputElement>("#score")?.value).toBe(
      "85",
    );

    act(() =>
      root.render(<ReviewScoreHarness initialValue={100} key="maximum" />),
    );
    expect(
      container.querySelector<HTMLButtonElement>(
        'button[aria-label="One point higher"]',
      )?.disabled,
    ).toBe(true);
  });

  it("limits typed scores to 100", () => {
    act(() => root.render(<ReviewScoreHarness initialValue={90} />));

    const input = container.querySelector<HTMLInputElement>("#score")!;
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.bind(input);
      setValue?.("999");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(input.value).toBe("100");
  });
});
