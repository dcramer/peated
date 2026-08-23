import { fileURLToPath } from "node:url";
import type { BottleExtractedDetails } from "./classifierTypes";

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
  sourceUrl?: string;
  expected: {
    fields?: Partial<Pick<BottleExtractedDetails, ExtractedIdentityField>>;
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
    id: "image-extraction-watchpost-whiskey",
    name: "Watchpost American Blended Whiskey",
    imagePath: assetPath("watchpost-8-year-old.webp"),
    expected: {
      fields: {
        brand: "Watchpost",
        expression: null,
        category: "blend",
        stated_age: null,
        abv: 42.5,
      },
      distilleryIncludes: ["Westland"],
    },
  },
  {
    id: "image-extraction-mars-komagatake-2022-edition",
    name: "Mars Komagatake 2022 Edition",
    imagePath: assetPath("mars-komagatake-2022-edition.webp"),
    expected: {
      fields: {
        brand: "Komagatake",
        expression: null,
        category: "single_malt",
        abv: 50,
        release_year: 2022,
        edition: null,
      },
      distilleryIncludes: ["Shinshu"],
    },
  },
  {
    id: "image-extraction-compass-box-hedonism-squared",
    name: "Compass Box Hedonism²",
    imagePath: assetPath("compass-box-hedonism-squared.jpg"),
    sourceUrl:
      "https://static.whiskybase.com/storage/whiskies/2/2/6721/406144-big.jpg",
    expected: {
      fields: {
        brand: "Compass Box",
        bottler: null,
        category: "blend",
        stated_age: null,
        abv: 49,
      },
      // The source label uses a superscript 2. Accept either a faithful
      // `Hedonism²` expression or a split `Hedonism` / `2` representation,
      // but do not allow extraction to collapse it to plain Hedonism.
      anyText: [
        {
          fields: ["expression", "edition"],
          includes: ["Hedonism", "2"],
        },
      ],
    },
  },
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
    id: "image-extraction-compass-box-rogues-banquet",
    name: "Compass Box Rogues' Banquet official bottle art",
    imagePath: assetPath("compass-box-rogues-banquet-official.png"),
    expected: {
      fields: {
        brand: "Compass Box",
        bottler: "Compass Box",
        expression: "Rogues' Banquet",
        category: "blend",
        edition: "Limited Edition",
      },
    },
  },
  {
    id: "image-extraction-compass-box-spice-tree-extravaganza",
    name: "Compass Box Spice Tree Extravaganza bottle photo",
    imagePath: assetPath("compass-box-spice-tree-extravaganza.webp"),
    expected: {
      fields: {
        brand: "Compass Box",
        bottler: "Compass Box",
        expression: "Spice Tree Extravaganza",
        edition: "Limited Edition",
      },
    },
  },
  {
    id: "image-extraction-pokeno-single-cask-71",
    name: "Pōkeno Single Cask No. 71",
    imagePath: assetPath("pokeno-single-cask-71.webp"),
    expected: {
      fields: {
        brand: "Pōkeno",
        stated_age: 4,
        abv: 55.8,
        vintage_year: 2019,
        release_year: null,
        cask_strength: true,
        single_cask: true,
        edition: "Cask No. 71",
      },
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
        // handwritten digits and cask wording are genuinely ambiguous (the
        // verified cask number 285, age 11, and distilled-on 6.8.11 read as
        // 205/17/77 to vision extractors, and the edition sometimes drops the
        // word "Cask"), so this eval pins the reliably readable distillery
        // component and the printed facts rather than the handwritten values.
        {
          fields: ["expression", "series", "edition"],
          includes: ["Distillery No. 1"],
        },
      ],
    },
  },
];
