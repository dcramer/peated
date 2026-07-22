import type {
  BottleFormFieldName,
  BottleFormSubmitMeta,
  BottleFormSubmitValue,
} from "@peated/web/components/bottleForm";
import { describe, expect, test } from "vitest";
import { buildConcreteBottleUpdateInput } from "./buildConcreteBottleUpdateInput";

function formValue(
  overrides: Partial<BottleFormSubmitValue> = {},
): BottleFormSubmitValue {
  return {
    name: "Springbank 12 Cask Strength",
    statedAge: 12,
    exactStatedAge: null,
    series: null,
    category: "single_malt",
    brand: 1,
    distillers: [2],
    bottler: null,
    flavorProfile: null,
    edition: "Batch 24",
    abv: 57.2,
    singleCask: false,
    caskStrength: true,
    vintageYear: null,
    releaseYear: 2024,
    caskSize: null,
    caskType: null,
    caskFill: null,
    description: "A batch release.",
    descriptionSrc: "user",
    tastingNotes: null,
    image: undefined,
    ...overrides,
  };
}

function submitMeta(
  ...dirtyFields: BottleFormFieldName[]
): BottleFormSubmitMeta {
  return { dirtyFields: new Set(dirtyFields) };
}

describe("buildConcreteBottleUpdateInput", () => {
  test("omits both scopes when neither stated-age control is dirty", () => {
    expect(
      buildConcreteBottleUpdateInput(
        formValue({ statedAge: 18 }),
        submitMeta(),
      ),
    ).toEqual({});
  });

  test("builds an exact-only patch without shared values", () => {
    expect(
      buildConcreteBottleUpdateInput(formValue(), submitMeta("edition", "abv")),
    ).toEqual({ exact: { edition: "Batch 24", abv: 57.2 } });
  });

  test("routes the Bottle-specific age to the exact patch", () => {
    expect(
      buildConcreteBottleUpdateInput(
        formValue({ exactStatedAge: 15 }),
        submitMeta("exactStatedAge"),
      ),
    ).toEqual({ exact: { statedAge: 15 } });
  });

  test("clears the Bottle-specific override without changing shared age", () => {
    expect(
      buildConcreteBottleUpdateInput(
        formValue({ statedAge: 12, exactStatedAge: null }),
        submitMeta("exactStatedAge"),
      ),
    ).toEqual({ exact: { statedAge: null } });
  });

  test("builds a shared-only patch without exact values", () => {
    expect(
      buildConcreteBottleUpdateInput(
        formValue(),
        submitMeta("name", "statedAge"),
      ),
    ).toEqual({
      shared: { name: "Springbank 12 Cask Strength", statedAge: 12 },
    });
  });

  test("maps the complete shared and exact form contract", () => {
    expect(
      buildConcreteBottleUpdateInput(
        formValue({
          series: 3,
          brand: 4,
          distillers: [5, 6],
          bottler: 7,
          flavorProfile: "deep_rich_dried_fruit",
          singleCask: true,
          exactStatedAge: 15,
          vintageYear: 2012,
          caskSize: "hogshead",
          caskType: "oloroso",
          caskFill: "1st_fill",
        }),
        submitMeta(
          "name",
          "statedAge",
          "series",
          "category",
          "brand",
          "distillers",
          "bottler",
          "flavorProfile",
          "edition",
          "exactStatedAge",
          "abv",
          "singleCask",
          "caskStrength",
          "vintageYear",
          "releaseYear",
          "caskSize",
          "caskType",
          "caskFill",
          "description",
          "descriptionSrc",
        ),
      ),
    ).toEqual({
      shared: {
        name: "Springbank 12 Cask Strength",
        statedAge: 12,
        series: 3,
        category: "single_malt",
        brand: 4,
        distillers: [5, 6],
        bottler: 7,
        flavorProfile: "deep_rich_dried_fruit",
      },
      exact: {
        edition: "Batch 24",
        statedAge: 15,
        abv: 57.2,
        singleCask: true,
        caskStrength: true,
        vintageYear: 2012,
        releaseYear: 2024,
        caskSize: "hogshead",
        caskType: "oloroso",
        caskFill: "1st_fill",
        description: "A batch release.",
        descriptionSrc: "user",
      },
    });
  });

  test("clears a removed image but leaves a new canvas to the upload route", () => {
    expect(
      buildConcreteBottleUpdateInput(formValue({ image: null }), submitMeta()),
    ).toEqual({ exact: { image: null } });

    expect(
      buildConcreteBottleUpdateInput(
        formValue({ image: {} as HTMLCanvasElement }),
        submitMeta(),
      ),
    ).toEqual({});
  });
});
