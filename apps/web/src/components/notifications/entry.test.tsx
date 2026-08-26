import type { Bottle, Entity, Notification } from "@peated/server/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getStatusMessage } from "./entry";
import { getFriendRequestPresentation } from "./friendRequestEntry";

const timestamp = "2026-07-21T00:00:00.000Z";

const brand = {
  id: 8,
  peatedId: "E0008",
  name: "Springbank",
  shortName: null,
  type: ["brand"],
  kind: null,
  ownerId: null,
  description: null,
  descriptionSrc: null,
  yearEstablished: null,
  website: null,
  country: null,
  region: null,
  address: null,
  location: null,
  totalTastings: 0,
  totalBottles: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
} satisfies Entity;

const bottle = {
  id: 19,
  peatedId: "B0019",
  fullName: "Springbank 12 Cask Strength Batch 24",
  name: "12 Cask Strength Batch 24",
  series: null,
  category: "single_malt",
  edition: "Batch 24",
  statedAge: 12,
  caskStrength: true,
  singleCask: false,
  naturalColor: null,
  nonChillFiltered: null,
  maltPhenolPpm: null,
  noAgeStatement: null,
  abv: 56.2,
  vintageYear: null,
  bottlingYear: null,
  releaseYear: 2026,
  releaseDate: null,
  maturation: null,
  caskNumber: null,
  outturn: null,
  brand,
  distillers: [],
  bottler: null,
  description: null,
  descriptionSrc: null,
  imageUrl: null,
  flavorProfile: null,
  tastingNotes: null,
  suggestedTags: [],
  avgRating: null,
  avgScore: null,
  totalScores: 0,
  ratingStats: {
    pass: 0,
    sip: 0,
    savor: 0,
    total: 0,
    avg: null,
    percentage: { pass: 0, sip: 0, savor: 0 },
  },
  totalTastings: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
  isFavorite: false,
  isLibrary: false,
  hasTasted: false,
} satisfies Bottle;

const notificationBase = {
  id: 1,
  objectId: 2,
  fromUser: null,
  createdAt: "2026-07-21T00:00:00.000Z",
  read: false,
};

function tasting() {
  return { id: 3, bottle };
}

describe("notification status message", () => {
  it("renders the independently complete exact Bottle label", () => {
    const notification = {
      ...notificationBase,
      type: "toast",
      ref: tasting(),
    } satisfies Notification;

    const html = renderToStaticMarkup(getStatusMessage({ notification }));

    expect(html).toContain("toasted <a");
    expect(html).toContain('href="/tastings/3"');
    expect(html).toContain("Springbank 12 Cask Strength Batch 24");
    expect(html).not.toContain("Exact bottle");
  });

  it("renders the exact Bottle label for a comment", () => {
    const notification = {
      ...notificationBase,
      type: "comment",
      ref: tasting(),
    } satisfies Notification;

    const html = renderToStaticMarkup(getStatusMessage({ notification }));

    expect(html).toContain("commented on <a");
    expect(html).toContain('href="/tastings/3"');
    expect(html).toContain("Springbank 12 Cask Strength Batch 24");
    expect(html).not.toContain("Exact bottle not specified");
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
