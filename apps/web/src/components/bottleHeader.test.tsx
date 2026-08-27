import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import BottleHeader, { type BottleHeaderBottle } from "./bottleHeader";

const EmptyIcon = () => null;

describe("BottleHeader", () => {
  it("separates the shared label from exact Bottle metadata", () => {
    const bottle = {
      id: 42,
      peatedId: "B0042",
      fullName: "Lagavulin 21 - Distillers Edition - 2025 Release - 55.1% ABV",
      name: "21 - Distillers Edition - 2025 Release - 55.1% ABV",
      group: {
        name: "21",
      },
      brand: {
        id: 7,
        kind: "distillery",
        name: "Lagavulin Distillery",
        shortName: "Lagavulin",
      },
      series: null,
      distillers: [],
      edition: "Distillers Edition",
      category: "single_malt",
      statedAge: 21,
      abv: 55.1,
      vintageYear: null,
      releaseYear: 2025,
      singleCask: null,
      caskStrength: true,
      outturn: null,
      maturation: null,
      caskNumber: null,
    } satisfies BottleHeaderBottle;

    const html = renderToStaticMarkup(
      <BottleHeader bottle={bottle} icon={EmptyIcon} />,
    );
    const text = html.replace(/<[^>]*>/g, "");

    expect(text).toContain("Lagavulin21");
    expect(text).not.toContain(bottle.fullName);
    expect(text).toContain("Distillers Edition·21 years·55.1% ABV");
    expect(text).not.toContain("2025 release");
    expect(text).not.toContain("Cask strength");
    expect(html).toContain(`title="${bottle.fullName}"`);
  });

  it("does not repeat an edition already expressed by the title", () => {
    const bottle = {
      id: 42,
      peatedId: "B0042",
      fullName: "Lagavulin Distillers Edition - 2025 Release",
      name: "Distillers Edition - 2025 Release",
      group: { name: "Distillers Edition" },
      brand: { id: 7, kind: "distillery", name: "Lagavulin", shortName: null },
      series: null,
      distillers: [],
      edition: "Distillers Edition",
      category: "single_malt",
      statedAge: null,
      abv: null,
      vintageYear: null,
      releaseYear: 2025,
      singleCask: null,
      caskStrength: null,
      outturn: null,
      maturation: null,
      caskNumber: null,
    } satisfies BottleHeaderBottle;

    const html = renderToStaticMarkup(
      <BottleHeader bottle={bottle} icon={EmptyIcon} />,
    );
    const text = html.replace(/<[^>]*>/g, "");

    expect(text.match(/Distillers Edition/g)).toHaveLength(1);
    expect(text).not.toContain("2025 release");
  });

  it("keeps repeated identity fields out of a single-cask header", () => {
    const bottle = {
      id: 42,
      peatedId: "B0042",
      fullName: "Pōkeno Double Bourbon Cask 3-year-old",
      name: "Double Bourbon Cask 3-year-old",
      group: { name: "Double Bourbon Cask 3-year-old" },
      brand: { id: 7, kind: "distillery", name: "Pōkeno", shortName: null },
      series: null,
      distillers: [{ id: 7, kind: "distillery", name: "Pōkeno" }],
      edition: null,
      category: "single_malt",
      statedAge: 3,
      abv: 56,
      vintageYear: null,
      releaseYear: null,
      singleCask: true,
      caskStrength: true,
      outturn: null,
      maturation: "Bourbon barrel",
      caskNumber: null,
    } satisfies BottleHeaderBottle;

    const html = renderToStaticMarkup(
      <BottleHeader bottle={bottle} icon={EmptyIcon} />,
    );
    const text = html.replace(/<[^>]*>/g, "");

    expect(text.match(/Pōkeno/g)).toHaveLength(1);
    expect(text).not.toContain("Single Cask");
    expect(text).not.toContain("3 years");
    expect(text).not.toContain("Bourbon cask");
    expect(text).toContain("56.0% ABV");
    expect(text).not.toContain("Cask strength");
    expect(text).not.toContain("Distilled at");
  });

  it("uses production wording for a non-blend distiller", () => {
    const bottle = {
      id: 42,
      peatedId: "B0042",
      fullName: "Compass Box Orchard House",
      name: "Orchard House",
      group: { name: "Orchard House" },
      brand: { id: 7, kind: "blender", name: "Compass Box", shortName: null },
      series: null,
      distillers: [{ id: 8, kind: "distillery", name: "Clynelish" }],
      edition: null,
      category: "single_malt",
      statedAge: null,
      abv: 46,
      vintageYear: null,
      releaseYear: null,
      singleCask: false,
      caskStrength: false,
      outturn: null,
      maturation: null,
      caskNumber: null,
    } satisfies BottleHeaderBottle;

    const html = renderToStaticMarkup(
      <BottleHeader bottle={bottle} icon={EmptyIcon} />,
    );
    const text = html.replace(/<[^>]*>/g, "");

    expect(text).toContain("Distilled atClynelish");
    expect(html).toContain('href="/blenders/7"');
    expect(html).toContain('href="/distillers/8"');
  });

  it("uses provenance wording for a blend with one known distillery", () => {
    const bottle = {
      id: 42,
      peatedId: "B0042",
      fullName: "Compass Box Orchard House",
      name: "Orchard House",
      group: { name: "Orchard House" },
      brand: { id: 7, kind: "blender", name: "Compass Box", shortName: null },
      series: null,
      distillers: [{ id: 8, kind: "distillery", name: "Clynelish" }],
      edition: null,
      category: "blend",
      statedAge: null,
      abv: 46,
      vintageYear: null,
      releaseYear: null,
      singleCask: false,
      caskStrength: false,
      outturn: null,
      maturation: null,
      caskNumber: null,
    } satisfies BottleHeaderBottle;

    const html = renderToStaticMarkup(
      <BottleHeader bottle={bottle} icon={EmptyIcon} />,
    );
    const text = html.replace(/<[^>]*>/g, "");

    expect(text).toContain("DistilleryClynelish");
    expect(text).not.toContain("Distilled at");
  });

  it("shows every distiller name in the multi-distiller tooltip", () => {
    const bottle = {
      id: 42,
      peatedId: "B0042",
      fullName: "Compass Box Seven Distilleries",
      name: "Seven Distilleries",
      group: { name: "Seven Distilleries" },
      brand: { id: 7, kind: "blender", name: "Compass Box", shortName: null },
      series: null,
      distillers: [
        { id: 1, kind: "distillery", name: "Aberlour" },
        { id: 2, kind: "distillery", name: "Clynelish" },
        { id: 3, kind: "distillery", name: "Dailuaine" },
        { id: 4, kind: "distillery", name: "Glen Elgin" },
        { id: 5, kind: "distillery", name: "Linkwood" },
        { id: 6, kind: "distillery", name: "Mortlach" },
        { id: 7, kind: "distillery", name: "Teaninich" },
      ],
      edition: null,
      category: "blend",
      statedAge: null,
      abv: 46,
      vintageYear: null,
      releaseYear: null,
      singleCask: false,
      caskStrength: false,
      outturn: null,
      maturation: null,
      caskNumber: null,
    } satisfies BottleHeaderBottle;

    const html = renderToStaticMarkup(
      <BottleHeader bottle={bottle} icon={EmptyIcon} />,
    );
    const text = html.replace(/<[^>]*>/g, "");

    expect(text).toContain("7 distilleries");
    for (const distillery of bottle.distillers) {
      expect(text).toContain(distillery.name);
    }
  });

  it("does not add a chip when Single Cask is already in the title", () => {
    const bottle = {
      id: 42,
      peatedId: "B0042",
      fullName: "Pōkeno Single Cask 4-year-old",
      name: "Single Cask 4-year-old",
      group: { name: "Single Cask 4-year-old" },
      brand: { id: 7, kind: "distillery", name: "Pōkeno", shortName: null },
      series: null,
      distillers: [],
      edition: null,
      category: null,
      statedAge: 4,
      abv: null,
      vintageYear: null,
      releaseYear: null,
      singleCask: true,
      caskStrength: false,
      outturn: null,
      maturation: null,
      caskNumber: null,
    } satisfies BottleHeaderBottle;

    const html = renderToStaticMarkup(
      <BottleHeader bottle={bottle} icon={EmptyIcon} />,
    );
    const text = html.replace(/<[^>]*>/g, "");

    expect(text.match(/Single Cask/g)).toHaveLength(1);
    expect(html).not.toContain('title="Single cask"');
  });

  it("promotes a nonduplicative series into the header context", () => {
    const bottle = {
      id: 42,
      peatedId: "B0042",
      fullName: "Decadent Drinks Glenburgie 38-year-old - Chapter Thirty Two",
      name: "Glenburgie 38-year-old - Chapter Thirty Two",
      group: { name: "Glenburgie 38-year-old" },
      brand: {
        id: 7,
        kind: "bottler",
        name: "Decadent Drinks",
        shortName: null,
      },
      series: { id: 9, name: "Whiskyland" },
      distillers: [{ id: 8, kind: "distillery", name: "Glenburgie" }],
      edition: "Chapter Thirty Two",
      category: "single_malt",
      statedAge: 38,
      abv: 46.7,
      vintageYear: 1988,
      releaseYear: 2026,
      singleCask: true,
      caskStrength: true,
      outturn: 180,
      maturation: "Bourbon barrel",
      caskNumber: "#5678",
    } satisfies BottleHeaderBottle;

    const html = renderToStaticMarkup(
      <BottleHeader bottle={bottle} icon={EmptyIcon} />,
    );
    const text = html.replace(/<[^>]*>/g, "");

    expect(text).toContain("Decadent Drinks·WhiskylandGlenburgie 38-year-old");
    expect(html).toContain('href="/bottles?series=9"');
    expect(text).toContain("Chapter Thirty Two·46.7% ABV");
    expect(text).not.toContain("1988 vintage");
    expect(text).not.toContain("2026 release");
    expect(text).not.toContain("Single cask");
    expect(text).not.toContain("Cask strength");
    expect(text).not.toContain("Bourbon Hogshead cask");
  });
});
