import { describe, expect, test } from "vitest";
import {
  composeExactCaskCodeFromComponents,
  getCategoryFromCask,
  parseCaskType,
  parseDetailsFromName,
  parseFlavorProfile,
  parseReferenceName,
} from "./smws";

const REPLICA_LABEL_TEXT =
  "THE SCOTCH MALT WHISKY SOCIETY Society Distillery No. 1 Single Cask No. 285 " +
  "11 years Aged Distilled on 6.8.11 SINGLE MALT SCOTCH WHISKY 63.4% ALC/VOL 700ml";

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
    expect(parseReferenceName("SMWS 162.1 Island intrigue")).toMatchObject({
      category: "single_malt",
      code: "162.1",
      distiller: "Isle of Raasay Distillery",
    });
    expect(parseReferenceName("SMWS 164.1 Welsh rarity")).toMatchObject({
      category: "single_malt",
      code: "164.1",
      distiller: "Penderyn Distillery",
    });
    expect(parseReferenceName("SMWS 165.1 Northern peat")).toMatchObject({
      category: "single_malt",
      code: "165.1",
      distiller: "Wolfburn",
    });
    expect(parseReferenceName("SMWS 166.1 Island smoke")).toMatchObject({
      category: "single_malt",
      code: "166.1",
      distiller: "Torabhaig",
    });
    expect(parseReferenceName("SMWS 167.1 Riverside dram")).toMatchObject({
      category: "single_malt",
      code: "167.1",
      distiller: "The Clydeside Distillery",
    });
    expect(parseReferenceName("SMWS 168.1 KinGlassie preview")).toMatchObject({
      category: "single_malt",
      code: "168.1",
      distiller: "InchDairnie Distillery",
    });
    expect(parseReferenceName("RW6.5 Sauna Smoke")).toBeNull();
    expect(parseReferenceName("SMWS single cask 54.2% ABV")).toBeNull();
  });

  describe("composeExactCaskCodeFromComponents", () => {
    test("composes the code from the replica label's separate components", () => {
      expect(composeExactCaskCodeFromComponents(REPLICA_LABEL_TEXT)).toBe(
        "1.285",
      );
    });

    test("composes without the Society/Single prefixes", () => {
      expect(
        composeExactCaskCodeFromComponents(
          "SMWS Distillery No. 1 Cask No. 285",
        ),
      ).toBe("1.285");
    });

    test("composes lettered distillery-number prefixes", () => {
      expect(
        composeExactCaskCodeFromComponents(
          "The Scotch Malt Whisky Society Distillery No. G15 Single Cask No. 3",
        ),
      ).toBe("G15.3");
    });

    test("refuses to compose without an SMWS identity anchor", () => {
      expect(
        composeExactCaskCodeFromComponents(
          "Distillery No. 1 Single Cask No. 285 63.4% ALC/VOL",
        ),
      ).toBeNull();
      expect(
        composeExactCaskCodeFromComponents(
          "Glenfarclas Distillery No. 1 Single Cask No. 285",
        ),
      ).toBeNull();
    });

    test("refuses to compose from a single component", () => {
      expect(
        composeExactCaskCodeFromComponents(
          "THE SCOTCH MALT WHISKY SOCIETY Society Distillery No. 1 11 years",
        ),
      ).toBeNull();
      expect(
        composeExactCaskCodeFromComponents(
          "THE SCOTCH MALT WHISKY SOCIETY Single Cask No. 285 11 years",
        ),
      ).toBeNull();
    });

    test("does not mis-compose when a printed code follows Cask No.", () => {
      // "Society Cask No. 95.71" already carries a full code; the digits before
      // the dot must not be treated as a cask-number component.
      expect(
        composeExactCaskCodeFromComponents(
          "SMWS Distillery No. 1 Society Cask No. 95.71",
        ),
      ).toBeNull();
    });

    test("returns null for empty or non-SMWS input", () => {
      expect(composeExactCaskCodeFromComponents(null)).toBeNull();
      expect(composeExactCaskCodeFromComponents("")).toBeNull();
      expect(
        composeExactCaskCodeFromComponents("Willett Distillery No. 1"),
      ).toBeNull();
    });
  });

  test("parseReferenceName composes a code from labeled components", () => {
    expect(
      parseReferenceName(
        "The Scotch Malt Whisky Society Society Distillery No. 1 Single Cask No. 285",
      ),
    ).toEqual({
      category: "single_malt",
      code: "1.285",
      distiller: "Glenfarclas",
      name: "1.285",
      selector: null,
    });
  });

  test("parseReferenceName still prefers a printed code over composition", () => {
    // A printed code wins, and its printed subtitle is preserved as the selector
    // even when component-style wording is also present.
    expect(
      parseReferenceName("SMWS 95.71 Prepare for Winter Single Cask No. 71"),
    ).toMatchObject({
      code: "95.71",
      selector: "Prepare for Winter Single Cask No. 71",
    });
  });
});
