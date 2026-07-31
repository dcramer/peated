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
      "Distillers Edition·Single Malt·21 years·55.1% ABV·2025 release·Cask strength",
    );
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
});
