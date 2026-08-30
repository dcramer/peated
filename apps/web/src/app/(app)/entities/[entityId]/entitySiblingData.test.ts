import { describe, expect, it } from "vitest";

import { shouldShowEntitySiblingOverview } from "./entitySiblingData";

describe("shouldShowEntitySiblingOverview", () => {
  it("hides a successful result that only contains the current entity", () => {
    expect(
      shouldShowEntitySiblingOverview({
        entityId: 1,
        error: false,
        ownerId: 10,
        pending: false,
        siblingList: { results: [{ id: 1 }] },
      }),
    ).toBe(false);
  });

  it("shows related entities and request feedback", () => {
    expect(
      shouldShowEntitySiblingOverview({
        entityId: 1,
        error: false,
        ownerId: 10,
        pending: false,
        siblingList: { results: [{ id: 1 }, { id: 2 }] },
      }),
    ).toBe(true);
    expect(
      shouldShowEntitySiblingOverview({
        entityId: 1,
        error: false,
        ownerId: 10,
        pending: true,
      }),
    ).toBe(true);
    expect(
      shouldShowEntitySiblingOverview({
        entityId: 1,
        error: true,
        ownerId: 10,
        pending: false,
      }),
    ).toBe(true);
  });

  it("hides the module when the entity has no owner", () => {
    expect(
      shouldShowEntitySiblingOverview({
        entityId: 1,
        error: false,
        ownerId: null,
        pending: true,
      }),
    ).toBe(false);
  });
});
