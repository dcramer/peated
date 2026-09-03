import { describe, expect, it, vi } from "vitest";

import {
  getEntityRowActionGroups,
  type EntityCatalogItem,
} from "./entityCatalog.stylex";

const item: EntityCatalogItem = {
  createBottleHref: "/bottles/new?brand=42",
  href: "/brands/42",
  id: 42,
  isFollowing: false,
  kind: "brand",
  name: "Example Brand",
  totalBottles: 3,
  totalTastings: 8,
};

describe("getEntityRowActionGroups", () => {
  it("offers bottle creation when the entity supports it", () => {
    expect(getEntityRowActionGroups({ item })[0]).toEqual([
      { href: "/bottles/new?brand=42", label: "Add a bottle" },
    ]);
  });

  it("offers the current follow action", () => {
    const onToggleFollowing = vi.fn();
    const action = getEntityRowActionGroups({
      item: { ...item, isFollowing: true },
      onToggleFollowing,
    })[1]?.[0];

    expect(action).toMatchObject({
      disabled: false,
      label: "Unfollow",
    });
    if (action?.onSelect) action.onSelect();
    expect(onToggleFollowing).toHaveBeenCalledWith({
      ...item,
      isFollowing: true,
    });
  });

  it("disables follow actions while one change is pending", () => {
    expect(
      getEntityRowActionGroups({
        item,
        onToggleFollowing: vi.fn(),
        pendingIds: new Set([item.id]),
      })[1]?.[0],
    ).toMatchObject({
      disabled: true,
      label: "Following…",
    });
  });

  it("keeps other follow actions enabled", () => {
    expect(
      getEntityRowActionGroups({
        item,
        onToggleFollowing: vi.fn(),
        pendingIds: new Set([7]),
      })[1]?.[0],
    ).toMatchObject({
      disabled: false,
      label: "Follow",
    });
  });
});
