import { describe, expect, test } from "vitest";
import {
  getCategoryFromCask,
  parseCaskType,
  parseDetailsFromName,
  parseFlavorProfile,
  parseReferenceName,
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
    expect(parseCaskType("refill rum barrel")).toEqual([
      "refill",
      null,
      "barrel",
    ]);
  });

  test("maps SMWS cask codes to categories", () => {
    expect(getCategoryFromCask("RW3.6")).toBe("rye");
    expect(getCategoryFromCask("41.176")).toBe("single_malt");
    expect(getCategoryFromCask("R2.19")).toBeNull();
    expect(getCategoryFromCask("A5.6")).toBeNull();
    expect(getCategoryFromCask("GN1.1")).toBeNull();
  });

  test("parses SMWS reference titles into code identity and selector", () => {
    expect(parseReferenceName("SMWS RW6.5 Sauna Smoke")).toEqual({
      category: "rye",
      code: "RW6.5",
      distiller: "Kyrö",
      name: "RW6.5 Sauna Smoke",
      selector: "Sauna Smoke",
    });
    expect(parseReferenceName("RW6.5 Sauna Smoke")).toBeNull();
  });
});
