import type {
  BottleFormFieldName,
  BottleFormSubmitMeta,
  BottleFormSubmitValue,
} from "@peated/web/components/bottleForm";
import { describe, expect, test } from "vitest";
import { buildBottlePatch } from "./buildBottlePatch";

function formValue(
  overrides: Partial<BottleFormSubmitValue> = {},
): BottleFormSubmitValue {
  return {
    name: "Springbank 12 Cask Strength",
    statedAge: 12,
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

describe("buildBottlePatch", () => {
  test("omits the age when it is not dirty", () => {
    expect(
      buildBottlePatch(formValue({ statedAge: 18 }), submitMeta()),
    ).toEqual({});
  });

  test("builds a sparse flat patch", () => {
    expect(buildBottlePatch(formValue(), submitMeta("edition", "abv"))).toEqual(
      { edition: "Batch 24", abv: 57.2 },
    );
  });

  test("submits one stated-age field", () => {
    expect(
      buildBottlePatch(formValue({ statedAge: 15 }), submitMeta("statedAge")),
    ).toEqual({ statedAge: 15 });
  });

  test("clears stated age without a storage scope", () => {
    expect(
      buildBottlePatch(formValue({ statedAge: null }), submitMeta("statedAge")),
    ).toEqual({ statedAge: null });
  });

  test("combines expression and Bottle fields in one patch", () => {
    expect(
      buildBottlePatch(formValue(), submitMeta("name", "statedAge")),
    ).toEqual({
      name: "Springbank 12 Cask Strength",
      statedAge: 12,
    });
  });

  test("maps the complete flat form contract", () => {
    expect(
      buildBottlePatch(
        formValue({
          series: 3,
          brand: 4,
          distillers: [5, 6],
          bottler: 7,
          flavorProfile: "deep_rich_dried_fruit",
          singleCask: true,
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
      name: "Springbank 12 Cask Strength",
      statedAge: 12,
      series: 3,
      category: "single_malt",
      brand: 4,
      distillers: [5, 6],
      bottler: 7,
      flavorProfile: "deep_rich_dried_fruit",
      edition: "Batch 24",
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
    });
  });

  test("clears a removed image but leaves a new canvas to the upload route", () => {
    expect(buildBottlePatch(formValue({ image: null }), submitMeta())).toEqual({
      image: null,
    });

    expect(
      buildBottlePatch(
        formValue({ image: {} as HTMLCanvasElement }),
        submitMeta(),
      ),
    ).toEqual({});
  });
});
