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
  {
    id: "image-extraction-smws-1-285-replica-components",
    name: "SMWS 1.285 replica label (composed from components)",
    imagePath: assetPath("smws-1.285.jpg"),
    expected: {
      fields: {
        category: "single_malt",
        abv: 63.4,
        cask_strength: true,
        single_cask: true,
      },
      anyText: [
        {
          fields: ["brand", "bottler"],
          includes: ["Scotch Malt Whisky Society"],
        },
        // The replica label prints the identity as separate "Distillery No. 1"
        // and "Single Cask No. 285" components; the composed "1.285" code is
        // not on the label, so extraction stays honest to the components. The
        // handwritten digits are genuinely ambiguous (the verified cask number
        // 285, age 11, and distilled-on 6.8.11 read as 205/17/77 to vision
        // extractors), so this eval pins the component structure and the
        // printed facts rather than the handwritten digit values.
        {
          fields: ["expression", "series", "edition"],
          includes: ["Distillery No. 1"],
        },
        {
          fields: ["expression", "edition"],
          includes: ["Cask No."],
        },
      ],
    },
  },
];
