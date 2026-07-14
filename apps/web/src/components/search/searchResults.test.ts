import type { Bottle, BottleRelease } from "@peated/server/types";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { getBottleResultHref } from "./bottleResult";
import { getBottlingResultHref } from "./bottlingResult";
import { getCreateBottleHref } from "./createBottleHref";
import ResultRow from "./result";

vi.mock("@peated/web/assets/bottle.svg", () => ({ default: () => null }));

describe("search result create bottle links", () => {
  it("targets the Create Bottle route for missing bottles", () => {
    expect(getCreateBottleHref({ query: "peated reserve" })).toBe(
      "/bottles/new?name=Peated+Reserve",
    );
  });

  it("preserves tasting intent for missing bottle creation", () => {
    expect(
      getCreateBottleHref({
        query: "peated reserve",
        returnAction: "tasting",
      }),
    ).toBe("/bottles/new?name=Peated+Reserve&returnAction=tasting");
  });

  it("preserves add bottle intent for missing bottle creation", () => {
    expect(
      getCreateBottleHref({
        query: "peated reserve",
        returnAction: "addBottle",
      }),
    ).toBe("/bottles/new?name=Peated+Reserve&returnAction=addBottle");
  });

  it("prefills extracted scan details for reviewed bottle creation", () => {
    expect(
      getCreateBottleHref({
        query: "playwright reserve",
        returnAction: "addBottle",
        prefill: {
          brandName: "Lagavulin",
          statedAge: 16,
          abv: 43,
          edition: "Distillers Edition",
          vintageYear: 2008,
          releaseYear: 2024,
        },
      }),
    ).toBe(
      "/bottles/new?name=Playwright+Reserve&returnAction=addBottle&brandName=Lagavulin&statedAge=16&abv=43&edition=Distillers+Edition&vintageYear=2008&releaseYear=2024",
    );
  });

  it("preserves pending scan images for reviewed bottle creation", () => {
    expect(
      getCreateBottleHref({
        query: "playwright reserve",
        returnAction: "addBottle",
        pendingImage: {
          id: "pending-photo",
          imageUrl: "http://127.0.0.1:4999/uploads/pending.webp",
        },
      }),
    ).toBe(
      "/bottles/new?name=Playwright+Reserve&returnAction=addBottle&pendingImageId=pending-photo&pendingImageUrl=http%3A%2F%2F127.0.0.1%3A4999%2Fuploads%2Fpending.webp",
    );
  });

  it("routes Add Bottle intent bottle rows through the Add Bottle flow", () => {
    expect(
      getBottleResultHref({
        bottleId: 123,
        addBottleIntent: "addBottle",
      }),
    ).toBe("/addBottle?bottle=123&intent=addBottle");
  });

  it("preserves pending scan images for Add Bottle search results", () => {
    expect(
      getBottleResultHref({
        bottleId: 123,
        addBottleIntent: "addBottle",
        pendingImage: {
          id: "pending-photo",
          imageUrl: "http://127.0.0.1:4999/uploads/pending.webp",
        },
      }),
    ).toBe(
      "/addBottle?bottle=123&pendingImageId=pending-photo&pendingImageUrl=http%3A%2F%2F127.0.0.1%3A4999%2Fuploads%2Fpending.webp&intent=addBottle",
    );
  });

  it("routes tasting search shortcuts through the Add Bottle flow", () => {
    expect(
      getBottleResultHref({
        bottleId: 123,
        directToTasting: true,
      }),
    ).toBe("/addBottle?bottle=123&intent=tasting");
  });

  it("links exact bottling results to the bottling page", () => {
    expect(
      getBottlingResultHref({
        bottleId: 123,
        bottlingId: 456,
      }),
    ).toBe("/bottles/123/bottlings/456");
  });

  it("preserves exact bottlings through Add Bottle intents", () => {
    expect(
      getBottlingResultHref({
        bottleId: 123,
        bottlingId: 456,
        addBottleIntent: "library",
      }),
    ).toBe("/addBottle?bottle=123&release=456&intent=library");
  });

  it("preserves exact bottlings through tasting shortcuts", () => {
    expect(
      getBottlingResultHref({
        bottleId: 123,
        bottlingId: 456,
        directToTasting: true,
      }),
    ).toBe("/addBottle?bottle=123&release=456&intent=tasting");
  });

  it("renders exact bottlings as distinct release links", () => {
    const bottle = {
      id: 123,
      fullName: "Laphroaig Cairdeas",
      category: "single_malt",
      distillers: [],
    } as unknown as Bottle;
    const bottling = {
      id: 456,
      bottleId: bottle.id,
      fullName: "Laphroaig Cairdeas Warehouse 1",
      name: "Cairdeas Warehouse 1",
      edition: "Warehouse 1",
      releaseYear: 2022,
      vintageYear: null,
      abv: 52.2,
      hasTasted: false,
    } as BottleRelease;

    const html = renderToStaticMarkup(
      createElement(ResultRow, {
        result: { type: "bottling", ref: bottling, bottle },
        directToTasting: false,
        addBottleIntent: "library",
      }),
    );

    expect(html).toContain("Laphroaig Cairdeas - Warehouse 1 (2022)");
    expect(html).toContain("Bottling of Laphroaig Cairdeas");
    expect(html).toContain(
      'href="/addBottle?bottle=123&amp;release=456&amp;intent=library"',
    );
  });
});
