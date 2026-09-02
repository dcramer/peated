import { describe, expect, it, vi } from "vitest";

import { getBottleRowActionGroups } from "./useBottleRowActions";

function getGroups(
  overrides: Partial<Parameters<typeof getBottleRowActionGroups>[0]> = {},
) {
  return getBottleRowActionGroups({
    bottle: { id: 42 },
    changePending: false,
    isLibrary: false,
    isLoggedIn: true,
    onLibraryToggle: vi.fn(),
    thisBottlePending: false,
    ...overrides,
  });
}

describe("getBottleRowActionGroups", () => {
  it("links to the tasting form", () => {
    expect(getGroups()[0]).toEqual([
      {
        href: "/addBottle?bottle=42&intent=tasting",
        label: "Log a tasting",
      },
    ]);
  });

  it("sends anonymous members through the protected Library flow", () => {
    expect(getGroups({ isLoggedIn: false })[1]).toEqual([
      {
        href: "/addBottle?bottle=42&intent=library",
        label: "Add to Library",
      },
    ]);
  });

  it("toggles the signed-in member's Library state", () => {
    const onLibraryToggle = vi.fn();
    const action = getGroups({ isLibrary: true, onLibraryToggle })[1]?.[0];

    expect(action).toMatchObject({
      disabled: false,
      label: "Remove from Library",
      onSelect: onLibraryToggle,
    });
  });

  it("shows which Library change is pending", () => {
    expect(
      getGroups({
        changePending: true,
        thisBottlePending: true,
      })[1]?.[0],
    ).toMatchObject({
      disabled: true,
      label: "Adding to Library…",
    });
  });
});
