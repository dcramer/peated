import {
  getTastingDraftBottleHref,
  parseTastingDraftId,
} from "@peated/web/lib/tastingDrafts";
import { describe, expect, test } from "vitest";
import {
  getCreateBottleHref,
  parseCreateBottlePrefill,
} from "./createBottleHref";

describe("getCreateBottleHref", () => {
  test("carries canonical category and entity ids into manual creation", () => {
    const href = getCreateBottleHref({
      query: "Canonical Expression",
      prefill: {
        brandId: 101,
        brandName: "Ignored Brand Name",
        category: "single_malt",
        distillerId: 202,
        distillerName: "Ignored Distillery Name",
        statedAge: 12,
        abv: 50,
        edition: "2022 Edition",
        vintageYear: 2010,
        releaseYear: 2022,
      },
    });
    const url = new URL(href, "https://peated.test");

    expect(url.searchParams.get("name")).toBe("Canonical Expression");
    expect(url.searchParams.get("brand")).toBe("101");
    expect(url.searchParams.get("brandName")).toBe("Ignored Brand Name");
    expect(url.searchParams.get("category")).toBe("single_malt");
    expect(url.searchParams.get("distiller")).toBe("202");
    expect(url.searchParams.get("distillerName")).toBe(
      "Ignored Distillery Name",
    );
    expect(parseCreateBottlePrefill(url.searchParams)).toMatchObject({
      brandId: 101,
      brandName: "Ignored Brand Name",
      category: "single_malt",
      distillerId: 202,
      distillerName: "Ignored Distillery Name",
      statedAge: 12,
      abv: 50,
      edition: "2022 Edition",
      vintageYear: 2010,
      releaseYear: 2022,
    });
  });

  test("round-trips the complete reviewed photo proposal", () => {
    const prefill = {
      brandId: 1422,
      brandName: "Compass Box",
      category: "blend" as const,
      distillers: [
        { id: 1204, name: "North British" },
        { id: 1270, name: "Port Dundas" },
        { id: 944, name: "Girvan" },
      ],
      bottlerId: 1422,
      bottlerName: "Compass Box",
      seriesId: 33,
      seriesName: "Hedonism",
      statedAge: 23,
      abv: 49,
      releaseYear: 2023,
      caskStrength: false,
      singleCask: false,
      maturation: "Bourbon barrel" as const,
      caskNumber: "#1234" as const,
      outturn: 240 as const,
    };
    const href = getCreateBottleHref({ query: "Hedonism²", prefill });
    const url = new URL(href, "https://peated.test");

    expect(url.searchParams.getAll("distiller")).toEqual([
      "1204",
      "1270",
      "944",
    ]);
    expect(url.searchParams.getAll("distillerName")).toEqual([
      "North British",
      "Port Dundas",
      "Girvan",
    ]);
    expect(parseCreateBottlePrefill(url.searchParams)).toMatchObject(prefill);
  });

  test("keeps unresolved distiller names aligned with resolved distillers", () => {
    const href = getCreateBottleHref({
      query: "Blended whisky",
      prefill: {
        distillers: [
          { id: null, name: "Unresolved Distillery" },
          { id: 1270, name: "Port Dundas" },
        ],
      },
    });
    const url = new URL(href, "https://peated.test");

    expect(url.searchParams.getAll("distiller")).toEqual(["", "1270"]);
    expect(parseCreateBottlePrefill(url.searchParams).distillers).toEqual([
      { id: null, name: "Unresolved Distillery" },
      { id: 1270, name: "Port Dundas" },
    ]);
  });

  test("returns a new Bottle to the tasting draft it came from", () => {
    const draftId = "5f0c6b8e-3c1d-4a5e-9b7f-2d4e6a8c0b1d";
    const href = getCreateBottleHref({
      query: "lagavulin 16",
      returnDraftId: draftId,
    });
    const url = new URL(href, "https://peated.test");

    expect(url.pathname).toBe("/bottles/new");
    expect(url.searchParams.get("name")).toBe("Lagavulin 16");

    // The create page reads the draft back and opens its confirm step.
    const returnDraftId = parseTastingDraftId(url.searchParams.get("draft"));
    expect(returnDraftId).toBe(draftId);
    expect(getTastingDraftBottleHref({ id: draftId }, 42)).toBe(
      `/drafts/${draftId}?bottle=42`,
    );
  });
});
