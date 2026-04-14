import { describe, expect, test } from "vitest";
import {
  getCategoryFromCask,
  parseCaskType,
  parseDetailsFromName,
  parseFlavorProfile,
} from "./smws";

describe("smws", () => {
  test("parses cask-number details from an SMWS bottle name", () => {
    expect(parseDetailsFromName("Cask No. 41.176 Baristaliscious")).toEqual({
      category: "single_malt",
      distiller: "Dailuaine",
      name: "41.176 Baristaliscious",
    });
  });

  test("maps SMWS flavor profile labels to canonical ids", () => {
    expect(parseFlavorProfile("Juicy Oak & Vanilla")).toBe("juicy_oak_vanilla");
    expect(parseFlavorProfile("Unknown Profile")).toBeNull();
  });

  test("parses SMWS cask details from retailer wording", () => {
    expect(parseCaskType("2nd fill ex-bourbon hogshead")).toEqual([
      "2nd_fill",
      "bourbon",
      "hogshead",
    ]);
  });

  test("maps SMWS cask codes to categories", () => {
    expect(getCategoryFromCask("RW3.6")).toBe("rye");
    expect(getCategoryFromCask("41.176")).toBe("single_malt");
  });
});
