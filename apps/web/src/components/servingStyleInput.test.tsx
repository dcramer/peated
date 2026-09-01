// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ServingStyleInput, type ServingStyle } from "./tastingInputs.stylex";

function ServingStyleHarness() {
  const [value, setValue] = useState<ServingStyle | null>(null);

  return (
    <ServingStyleInput
      id="serving"
      name="servingStyle"
      onChange={setValue}
      value={value}
    />
  );
}

describe("ServingStyleInput", () => {
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

  it("selects one serving style", () => {
    act(() => root.render(<ServingStyleHarness />));

    const neat = container.querySelector<HTMLInputElement>("#serving-neat")!;
    const rocks = container.querySelector<HTMLInputElement>("#serving-rocks")!;

    expect(neat.checked).toBe(false);
    expect(rocks.checked).toBe(false);

    act(() => rocks.click());

    expect(neat.checked).toBe(false);
    expect(rocks.checked).toBe(true);
  });
});
