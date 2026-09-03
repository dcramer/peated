// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ReviewScoreInput } from "./tastingInputs.stylex";

function ReviewScoreHarness({
  initialValue,
  disabled = false,
}: {
  initialValue: number | null;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <ReviewScoreInput
      disabled={disabled}
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

  it("suggests 80 for an empty score and stays within the 0–100 range", () => {
    act(() => root.render(<ReviewScoreHarness initialValue={null} />));

    expect(
      container.querySelector<HTMLInputElement>("#score")?.placeholder,
    ).toBe("80");

    const increase = container.querySelector<HTMLButtonElement>(
      'button[aria-label="One point higher"]',
    );
    act(() => increase?.click());

    expect(container.querySelector<HTMLInputElement>("#score")?.value).toBe(
      "80",
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

  it("updates the numeric score and rating range from the slider", () => {
    act(() => root.render(<ReviewScoreHarness initialValue={85} />));
    const slider = container.querySelector<HTMLInputElement>(
      'input[type="range"]',
    )!;

    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(slider, "94");
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(container.querySelector<HTMLInputElement>("#score")?.value).toBe(
      "94",
    );
    expect(slider.getAttribute("aria-valuetext")).toBe(
      "94 out of 100, Outstanding",
    );
  });

  it("keeps empty and low typed scores until the slider is used", () => {
    act(() => root.render(<ReviewScoreHarness initialValue={null} />));
    expect(container.querySelector<HTMLInputElement>("#score")?.value).toBe("");
    expect(
      container
        .querySelector('input[type="range"]')
        ?.getAttribute("aria-valuetext"),
    ).toBe("No score selected");

    act(() =>
      container.querySelector<HTMLInputElement>('input[type="range"]')!.click(),
    );
    expect(container.querySelector<HTMLInputElement>("#score")?.value).toBe(
      "80",
    );

    act(() =>
      root.render(<ReviewScoreHarness initialValue={42} key="low-score" />),
    );
    expect(container.querySelector<HTMLInputElement>("#score")?.value).toBe(
      "42",
    );
    expect(
      container.querySelector<HTMLInputElement>('input[type="range"]')?.value,
    ).toBe("60");
    expect(
      container
        .querySelector('input[type="range"]')
        ?.getAttribute("aria-valuetext"),
    ).toBe("Typed score 42; slider starts at 60");

    act(() => {
      container
        .querySelector<HTMLInputElement>('input[type="range"]')!
        .dispatchEvent(
          new KeyboardEvent("keyup", { key: "Home", bubbles: true }),
        );
    });
    expect(container.querySelector<HTMLInputElement>("#score")?.value).toBe(
      "60",
    );
  });

  it("disables the slider along with the other score controls", () => {
    act(() => root.render(<ReviewScoreHarness disabled initialValue={89} />));
    expect(
      container.querySelector<HTMLInputElement>('input[type="range"]')
        ?.disabled,
    ).toBe(true);
  });
});
