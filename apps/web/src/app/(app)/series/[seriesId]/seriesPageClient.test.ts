import { describe, expect, it, vi } from "vitest";

import { getSeriesBottleActionGroups } from "./seriesPageClient.stylex";

function getGroups(
  overrides: Partial<Parameters<typeof getSeriesBottleActionGroups>[0]> = {},
) {
  return getSeriesBottleActionGroups({
    bottle: { id: 42 },
    isLibrary: false,
    isLoggedIn: true,
    libraryMutationPending: false,
    onLibraryToggle: vi.fn(),
    thisBottlePending: false,
    ...overrides,
  });
}

describe("getSeriesBottleActionGroups", () => {
  it("links to the tasting form", () => {
    expect(getGroups()[0]).toEqual([
      {
        href: "/addBottle?bottle=42&intent=tasting",
        label: "Log a tasting",
      },
    ]);
  });

  it("sends anonymous members through the protected library flow", () => {
    expect(getGroups({ isLoggedIn: false })[1]).toEqual([
      {
        href: "/addBottle?bottle=42&intent=library",
        label: "Add to Library",
      },
    ]);
  });

  it("toggles the signed-in member's library state", () => {
    const onLibraryToggle = vi.fn();
    const action = getGroups({ isLibrary: true, onLibraryToggle })[1]?.[0];

    expect(action).toMatchObject({
      disabled: false,
      label: "Remove from Library",
      onSelect: onLibraryToggle,
    });
  });

  it("shows which library change is pending", () => {
    expect(
      getGroups({
        libraryMutationPending: true,
        thisBottlePending: true,
      })[1]?.[0],
    ).toMatchObject({
      disabled: true,
      label: "Adding to Library…",
    });
  });
});
