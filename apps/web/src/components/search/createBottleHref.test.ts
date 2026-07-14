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
    expect(url.searchParams.get("brandName")).toBeNull();
    expect(url.searchParams.get("category")).toBe("single_malt");
    expect(url.searchParams.get("distiller")).toBe("202");
    expect(url.searchParams.get("distillerName")).toBeNull();
    expect(parseCreateBottlePrefill(url.searchParams)).toMatchObject({
      brandId: 101,
      category: "single_malt",
      distillerId: 202,
      statedAge: 12,
      abv: 50,
      edition: "2022 Edition",
      vintageYear: 2010,
      releaseYear: 2022,
    });
  });
});
