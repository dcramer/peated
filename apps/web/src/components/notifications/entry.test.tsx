import type { CatalogTargetV1 } from "@peated/server/schemas";
import { CatalogTargetV1Schema } from "@peated/server/schemas";
import type { Notification } from "@peated/server/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getStatusMessage } from "./entry";
import { getFriendRequestPresentation } from "./friendRequestEntry";

const ratingStats = {
  pass: 0,
  sip: 0,
  savor: 0,
  total: 0,
  avg: null,
  percentage: { pass: 0, sip: 0, savor: 0 },
};

const group = {
  schemaVersion: 1,
  id: 7,
  fullName: "Springbank 12 Cask Strength",
  name: "12 Cask Strength",
  brandId: 8,
  bottlerId: null,
  distillerIds: [8],
  category: "single_malt",
  seriesId: null,
  statedAge: 12,
  representativeBottleId: 19,
  description: null,
  descriptionSrc: null,
  imageUrl: null,
  flavorProfile: null,
  tastingNotes: null,
  suggestedTags: [],
  avgRating: null,
  ratingStats,
  totalTastings: 1,
  totalBottles: 1,
  createdByActorId: 9,
  createdAt: "2026-07-21T00:00:00.000Z",
  updatedAt: "2026-07-21T00:00:00.000Z",
};

const bottle = {
  schemaVersion: 1,
  id: 19,
  groupId: group.id,
  fullName: "Springbank 12 Cask Strength Batch 24",
  name: "12 Cask Strength Batch 24",
  brandId: group.brandId,
  bottlerId: null,
  distillerIds: group.distillerIds,
  category: group.category,
  seriesId: null,
  flavorProfile: null,
  edition: "Batch 24",
  statedAge: 12,
  abv: 56.2,
  singleCask: false,
  caskStrength: true,
  vintageYear: null,
  releaseYear: 2026,
  caskSize: null,
  caskType: null,
  caskFill: null,
  description: null,
  descriptionSrc: null,
  imageUrl: null,
  tastingNotes: null,
  suggestedTags: [],
  avgRating: null,
  ratingStats,
  totalTastings: 1,
  createdByActorId: 9,
  createdAt: "2026-07-21T00:00:00.000Z",
  updatedAt: "2026-07-21T00:00:00.000Z",
};

const groupTarget = CatalogTargetV1Schema.parse({
  schemaVersion: 1,
  kind: "group",
  targetId: 41,
  group,
});

const bottleTarget = CatalogTargetV1Schema.parse({
  schemaVersion: 1,
  kind: "bottle",
  targetId: 42,
  group,
  bottle,
});

const notificationBase = {
  id: 1,
  objectId: 2,
  fromUser: null,
  createdAt: "2026-07-21T00:00:00.000Z",
  read: false,
};

function tasting(target: CatalogTargetV1) {
  return { id: 3, target };
}

describe("notification status message", () => {
  it("renders the independently complete exact Bottle label", () => {
    const notification = {
      ...notificationBase,
      type: "toast",
      ref: tasting(bottleTarget),
    } satisfies Notification;

    const html = renderToStaticMarkup(getStatusMessage({ notification }));

    expect(html).toContain("toasted <a");
    expect(html).toContain('href="/tastings/3"');
    expect(html).toContain("Springbank 12 Cask Strength Batch 24");
    expect(html).not.toContain("Exact bottle");
  });

  it("renders a generic BottleGroup label without inventing a Bottle", () => {
    const notification = {
      ...notificationBase,
      type: "comment",
      ref: tasting(groupTarget),
    } satisfies Notification;

    const html = renderToStaticMarkup(getStatusMessage({ notification }));

    expect(html).toContain("commented on <a");
    expect(html).toContain("</a> <span");
    expect(html).toContain('href="/tastings/3"');
    expect(html).toContain("Springbank 12 Cask Strength");
    expect(html).not.toContain("Batch 24");
    expect(html).toContain("Exact bottle not specified");
  });

  const missingTastingCases = [
    ["toast", "toasted unknown tasting"],
    ["comment", "commented on an unknown tasting"],
  ] satisfies ReadonlyArray<readonly ["toast" | "comment", string]>;

  it.each(missingTastingCases)(
    "preserves the missing %s fallback prose",
    (type, message) => {
      const notification = {
        ...notificationBase,
        type,
        ref: null,
      } satisfies Notification;

      const html = renderToStaticMarkup(getStatusMessage({ notification }));

      expect(html).toContain(message);
      expect(html).not.toContain("<a");
    },
  );
});

describe("friend request notification action", () => {
  const actionableStatuses = ["pending", "none"] satisfies ReadonlyArray<
    Parameters<typeof getFriendRequestPresentation>[0]
  >;

  it.each(actionableStatuses)(
    "offers a non-destructive response for %s requests",
    (status) => {
      expect(getFriendRequestPresentation(status)).toEqual({
        kind: "request",
        actionLabel: "Add Friend",
        archiveLabel: "Ignore",
      });
    },
  );

  it("renders an accepted state without presenting a remove action", () => {
    expect(getFriendRequestPresentation("friends")).toEqual({
      kind: "accepted",
      archiveLabel: "Dismiss",
      statusLabel: "Friends",
    });
  });
});
