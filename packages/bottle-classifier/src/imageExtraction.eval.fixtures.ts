import { fileURLToPath } from "node:url";

export type ExtractedIdentityField =
  | "brand"
  | "bottler"
  | "expression"
  | "series"
  | "category"
  | "stated_age"
  | "abv"
  | "release_year"
  | "vintage_year"
  | "cask_strength"
  | "single_cask"
  | "edition";

type TextExpectation = {
  field: ExtractedIdentityField;
  includes?: string[];
  excludes?: string[];
};

type AnyTextExpectation = {
  fields: ExtractedIdentityField[];
  includes: string[];
};

export type ImageExtractionEvalCase = {
  id: string;
  name: string;
  imagePath: string;
  expected: {
    fields?: Partial<Record<ExtractedIdentityField, unknown>>;
    text?: TextExpectation[];
    anyText?: AnyTextExpectation[];
    distilleryIncludes?: string[];
  };
};

const assetDir = fileURLToPath(
  new URL("./eval-fixtures/assets/photo-add-bottle-misses/", import.meta.url),
);

const assetPath = (filename: string) => `${assetDir}/${filename}`;

export const IMAGE_EXTRACTION_EVAL_CASES: ImageExtractionEvalCase[] = [
  {
    id: "image-extraction-willett-family-estate-barrel-4769",
    name: "Willett Family Estate barrel 4769",
    imagePath: assetPath("willett-family-estate-barrel-4769.jpg"),
    expected: {
      fields: {
        brand: "Willett",
        category: "bourbon",
        stated_age: 5,
        abv: 64.2,
        cask_strength: true,
        single_cask: true,
      },
      text: [
        {
          field: "expression",
          includes: ["Family Estate", "Single Barrel"],
          excludes: ["Small Batch", "2504"],
        },
      ],
      anyText: [
        {
          fields: ["expression", "edition"],
          includes: ["4769"],
        },
      ],
    },
  },
  {
    id: "image-extraction-high-west-midwinter-act-10-scene-4",
    name: "High West A Midwinter Night's Dram Act 10 Scene 4",
    imagePath: assetPath("high-west-midwinter-act-10-scene-4.jpg"),
    expected: {
      fields: {
        brand: "High West",
        category: "rye",
        abv: 49.3,
      },
      text: [
        {
          field: "expression",
          includes: ["Midwinter", "Dram"],
        },
      ],
      anyText: [
        {
          fields: ["expression", "edition"],
          includes: ["Act 10"],
        },
      ],
    },
  },
  {
    id: "image-extraction-high-west-high-country-batch-23j12",
    name: "High West High Country",
    imagePath: assetPath("high-west-high-country-batch-23j12.jpg"),
    expected: {
      fields: {
        brand: "High West",
        category: "single_malt",
        abv: 44,
      },
      text: [
        {
          field: "expression",
          includes: ["High Country"],
          excludes: ["23J12"],
        },
        {
          field: "edition",
          includes: ["Batch", "23J12"],
        },
      ],
    },
  },
  {
    id: "image-extraction-trestle-spirit-of-eclipse",
    name: "Trestle Spirit of Eclipse",
    imagePath: assetPath("trestle-spirit-of-eclipse.jpg"),
    expected: {
      fields: {
        abv: 50,
      },
      text: [
        {
          field: "expression",
          includes: ["Spirit of Eclipse"],
        },
      ],
      anyText: [
        {
          fields: ["brand", "bottler"],
          includes: ["Trestle"],
        },
      ],
      distilleryIncludes: ["Trestle"],
    },
  },
  {
    id: "image-extraction-smws-95-71-prepare-for-winter",
    name: "SMWS 95.71 Prepare for Winter",
    imagePath: assetPath("smws-95-71-prepare-for-winter.jpg"),
    expected: {
      fields: {
        category: "single_malt",
        stated_age: 14,
        abv: 57,
        vintage_year: 2007,
        single_cask: true,
      },
      text: [
        {
          field: "expression",
          includes: ["Prepare for Winter"],
          excludes: ["Serrano", "plums"],
        },
      ],
      anyText: [
        {
          fields: ["brand", "bottler"],
          includes: ["SMWS"],
        },
        {
          fields: ["expression", "edition"],
          includes: ["95.71"],
        },
      ],
    },
  },
];
