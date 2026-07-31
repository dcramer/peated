import type { Bottle } from "@peated/server/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import BottleHeader from "./bottleHeader";

vi.mock("@peated/web/assets/bottle.svg", () => ({ default: "svg" }));

describe("BottleHeader", () => {
  it("separates the shared label from exact Bottle metadata", () => {
    const bottle = {
      id: 42,
      fullName: "Lagavulin 21 - Distillers Edition - 2025 Release - 55.1% ABV",
      name: "21 - Distillers Edition - 2025 Release - 55.1% ABV",
      group: {
        name: "21",
      },
      brand: {
        id: 7,
        name: "Lagavulin Distillery",
        shortName: "Lagavulin",
      },
      distillers: [],
      edition: "Distillers Edition",
      category: "single_malt",
      statedAge: 21,
      abv: 55.1,
      vintageYear: null,
      releaseYear: 2025,
      singleCask: null,
      caskStrength: true,
      caskFill: null,
      caskType: null,
      caskSize: null,
    } as unknown as Bottle;

    const html = renderToStaticMarkup(<BottleHeader bottle={bottle} />);
    const text = html.replace(/<[^>]*>/g, "");

    expect(text).toContain("Lagavulin21");
    expect(text).not.toContain(bottle.fullName);
    expect(text).toContain(
      "Distillers Edition·Single Malt·21 years·55.1% ABV·2025 release",
    );
    expect(text).not.toContain("Cask strength");
    expect(html).toContain(`title="${bottle.fullName}"`);
  });

  it("does not repeat an edition already expressed by the title", () => {
    const bottle = {
      id: 42,
      fullName: "Lagavulin Distillers Edition - 2025 Release",
      name: "Distillers Edition - 2025 Release",
      group: { name: "Distillers Edition" },
      brand: { id: 7, name: "Lagavulin", shortName: null },
      distillers: [],
      edition: "Distillers Edition",
      category: "single_malt",
      statedAge: null,
      abv: null,
      vintageYear: null,
      releaseYear: 2025,
      singleCask: null,
      caskStrength: null,
      caskFill: null,
      caskType: null,
      caskSize: null,
    } as unknown as Bottle;

    const html = renderToStaticMarkup(<BottleHeader bottle={bottle} />);
    const text = html.replace(/<[^>]*>/g, "");

    expect(text.match(/Distillers Edition/g)).toHaveLength(1);
    expect(text).toContain("2025 release");
  });

  it("keeps repeated identity fields out of a single-cask header", () => {
    const bottle = {
      id: 42,
      fullName: "Pōkeno Double Bourbon Cask 3-year-old",
      name: "Double Bourbon Cask 3-year-old",
      group: { name: "Double Bourbon Cask 3-year-old" },
      brand: { id: 7, name: "Pōkeno", shortName: null },
      distillers: [{ id: 7, name: "Pōkeno" }],
      edition: null,
      category: "single_malt",
      statedAge: 3,
      abv: 56,
      vintageYear: null,
      releaseYear: null,
      singleCask: true,
      caskStrength: true,
      caskFill: null,
      caskType: "bourbon",
      caskSize: null,
    } as unknown as Bottle;

    const html = renderToStaticMarkup(<BottleHeader bottle={bottle} />);
    const text = html.replace(/<[^>]*>/g, "");

    expect(text.match(/Pōkeno/g)).toHaveLength(1);
    expect(text.match(/Single Cask/g)).toHaveLength(1);
    expect(text).not.toContain("3 years");
    expect(text).not.toContain("Bourbon cask");
    expect(text).toContain("Single Malt·56.0% ABV");
    expect(text).not.toContain("Cask strength");
    expect(text).not.toContain("Distilled at");
  });

  it("retains distinct distiller attribution", () => {
    const bottle = {
      id: 42,
      fullName: "Compass Box Orchard House",
      name: "Orchard House",
      group: { name: "Orchard House" },
      brand: { id: 7, name: "Compass Box", shortName: null },
      distillers: [{ id: 8, name: "Clynelish" }],
      edition: null,
      category: "blend",
      statedAge: null,
      abv: 46,
      vintageYear: null,
      releaseYear: null,
      singleCask: false,
      caskStrength: false,
      caskFill: null,
      caskType: null,
      caskSize: null,
    } as unknown as Bottle;

    const html = renderToStaticMarkup(<BottleHeader bottle={bottle} />);
    const text = html.replace(/<[^>]*>/g, "");

    expect(text).toContain("Distilled atClynelish");
  });

  it("does not add a chip when Single Cask is already in the title", () => {
    const bottle = {
      id: 42,
      fullName: "Pōkeno Single Cask 4-year-old",
      name: "Single Cask 4-year-old",
      group: { name: "Single Cask 4-year-old" },
      brand: { id: 7, name: "Pōkeno", shortName: null },
      distillers: [],
      edition: null,
      category: null,
      statedAge: 4,
      abv: null,
      vintageYear: null,
      releaseYear: null,
      singleCask: true,
      caskStrength: false,
      caskFill: null,
      caskType: null,
      caskSize: null,
    } as unknown as Bottle;

    const html = renderToStaticMarkup(<BottleHeader bottle={bottle} />);
    const text = html.replace(/<[^>]*>/g, "");

    expect(text.match(/Single Cask/g)).toHaveLength(1);
    expect(html).not.toContain('title="Single cask"');
  });
});
