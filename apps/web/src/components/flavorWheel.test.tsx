// @vitest-environment jsdom

import {
  mockBottleFlavorProfile,
  mockFlavorProfile,
} from "@peated/server/orpc/mock/fixtures/flavorProfile";
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
    expect(fruit.getAttribute("aria-haspopup")).toBe("dialog");
    expect(explored).toEqual(["fruit", "smoke", "fruit"]);
    expect(container.querySelector("button")).toBeNull();
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

test("uses tasting commonality for a bottle and keeps sparse notes interactive", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    act(() => root.render(<FlavorWheel profile={mockBottleFlavorProfile} />));
    expect(
      container.querySelector(
        '[aria-label^="Smoke, 83% of tastings with notes"]',
      ),
    ).not.toBeNull();
    expect(container.textContent).not.toMatch(/\d+ bottles|Notes cover/);
    act(() =>
      root.render(
        <FlavorWheel
          profile={{
            notedTastings: 1,
            categories: [
              {
                category: "smoke",
                tastingCount: 1,
                notes: [{ name: "peat", tastingCount: 1 }],
              },
            ],
          }}
        />,
      ),
    );
    expect(
      container.querySelector(
        '[aria-label^="Smoke, 100% of tastings with notes"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[aria-label^="Wood, 0% of tastings with notes"]',
      ),
    ).not.toBeNull();
    act(() =>
      root.render(
        <FlavorWheel
          profile={{ ...mockFlavorProfile, notedBottles: 0, categories: [] }}
        />,
      ),
    );
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("details")).toBeNull();
    expect(container.textContent).toBe("No public tasting notes yet.");
  } finally {
    act(() => root.unmount());
  }
});
