// @vitest-environment jsdom

import { mockFlavorProfile } from "@peated/server/orpc/mock/fixtures/flavorProfile";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { FlavorWheel } from "./flavorWheel.stylex";

test("selects flavor families with the keyboard and pointer", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const explored: string[] = [];
  try {
    act(() =>
      root.render(
        <FlavorWheel
          profile={mockFlavorProfile}
          onExplore={(category) => explored.push(category)}
        />,
      ),
    );
    const fruit = container.querySelector(
      '[role="button"][aria-label^="Fruit,"]',
    )!;
    const smoke = container.querySelector(
      '[role="button"][aria-label^="Smoke,"]',
    )!;
    expect(smoke.getAttribute("aria-pressed")).toBe("true");
    await act(() =>
      fruit.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    );
    expect(fruit.getAttribute("aria-pressed")).toBe("true");
    expect(smoke.getAttribute("aria-pressed")).toBe("false");
    await act(() =>
      smoke.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    expect(smoke.getAttribute("aria-pressed")).toBe("true");
    await act(() =>
      fruit.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true }),
      ),
    );
    expect(fruit.getAttribute("aria-pressed")).toBe("true");
    await act(() =>
      container
        .querySelector("button[aria-haspopup=dialog]")!
        .dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    expect(explored).toEqual(["fruit"]);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
