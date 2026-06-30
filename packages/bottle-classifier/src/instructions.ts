import { BOTTLE_SCHEMA_RULES } from "./bottleSchemaGuidance";

type WhiskyLabelComponent = {
  id: string;
  label: string;
  outputField: string;
  guidance: string[];
};

type RetailerLabelExample = {
  source: string;
  label: string;
  notes: string[];
};

type ExtractionExample = {
  input: string;
  output: Record<string, unknown> | null;
};

const CATEGORY_VALUES = [
  "`blend`",
  "`bourbon`",
  "`rye`",
  "`single_grain`",
  "`single_malt`",
  "`single_pot_still`",
].join(", ");

export const WHISKY_LABEL_COMPONENTS: WhiskyLabelComponent[] = [
  {
    id: "producer",
    label: "Brand",
    outputField: "`brand`",
    guidance: [
      "Use the most prominent consumer-facing brand on the label.",
      "For official single-distillery releases, `brand` is often the distillery name, but not always.",
      "Keep the consumer-facing brand even when the actual distillery is a different or longer name, such as `Jura` bottled at `Isle of Jura` or `Ledaig` bottled at `Tobermory`.",
      "For independent bottlings, `brand` is usually the bottler label and the actual producer belongs in `distillery`.",
    ],
  },
  {
    id: "bottler",
    label: "Separate bottler",
    outputField: "`bottler`",
    guidance: [
      "Populate this only when a bottler is explicitly stated separately from the label brand.",
      "If the label brand itself is the bottler, leave `bottler` as `null` instead of duplicating `brand`.",
    ],
  },
  {
    id: "distillery",
    label: "Distillery",
    outputField: "`distillery`",
    guidance: [
      "Capture the actual producing distillery or distilleries.",
      "Return an array with one value for a single-distillery whisky.",
      "Use `[]` when the whisky is real but the producing distillery is not stated.",
    ],
  },
  {
    id: "expression",
    label: "Expression",
    outputField: "`expression`",
    guidance: [
      "This is the core release name after removing the producer, generic style words, age, ABV, and package size.",
      "If the title is only producer plus age plus generic style words, `expression` can be `null`.",
    ],
  },
  {
    id: "series",
    label: "Series / range",
    outputField: "`series`",
    guidance: [
      "Use this for a stable collection or family such as `Private Selection`, `Distillers Edition`, or `Octomore 13`.",
      "Do not use `series` for one-off batch codes or release years that belong in `edition`.",
    ],
  },
  {
    id: "edition",
    label: "Edition / batch / release code",
    outputField: "`edition`",
    guidance: [
      "Use this for batch labels, store-pick codes, release identifiers, or numbered editions such as `Batch 3`, `2021 Release`, `Vol. 3`, `Release No. 5`, or `S2B13`.",
      "Treat short suffix codes as meaningful identity signals when they look like a batch or store-pick marker.",
      "If `edition` captures a batch, store-pick, or release label, do not repeat that same text inside `expression` or `proposedBottle.name`.",
    ],
  },
  {
    id: "category",
    label: "Category / style",
    outputField: "`category`",
    guidance: [
      `Normalize into one of ${CATEGORY_VALUES}.`,
      "Only return `single_malt` when the source explicitly says single malt. Do not collapse `malt whiskey` or `straight malt whiskey` into `single_malt`; leave `category` as `null` if no house value fits.",
      "If the whisky category is unclear, return `null` instead of using a broader fallback bucket.",
    ],
  },
  {
    id: "age",
    label: "Age statement",
    outputField: "`stated_age`",
    guidance: [
      "Convert age statements into an integer number of years.",
      "Recognize common retailer abbreviations such as `12 Yr.` or `16yr`.",
    ],
  },
  {
    id: "cask",
    label: "Cask / finish",
    outputField: "`cask_type`",
    guidance: [
      "Capture the primary cask or finish wording when it is part of the product identity.",
      "Keep descriptive phrases such as `First Fill Bourbon`, `PX Cask Finish`, or `Oloroso Sherry`.",
    ],
  },
  {
    id: "strength",
    label: "Strength and barrel flags",
    outputField: "`cask_strength`, `single_cask`",
    guidance: [
      "Set `cask_strength` to true only when the label explicitly says cask strength, barrel strength, barrel proof, full proof, natural strength, or similar.",
      "Set `single_cask` to true only when the label explicitly says single cask, single barrel, or a specific cask/barrel selection.",
    ],
  },
  {
    id: "technical",
    label: "Technical details",
    outputField:
      "`abv`, `vintage_year`, `release_year`, `cask_size`, `cask_fill`",
    guidance: [
      "ABV is the numeric alcohol percentage.",
      "If the source gives proof instead of ABV, convert proof to ABV by dividing by 2. Never copy a proof number directly into `abv`.",
      "Use `vintage_year` for the distillation year and `release_year` for the bottling or release year.",
      "Use `cask_size` and `cask_fill` only when they are explicitly stated.",
    ],
  },
];

export const NON_IDENTITY_LABEL_NOISE = [
  "volume and pack size such as `50ml`, `750ml`, `1L`, or `1.75L`",
  "gift sets, glasses, mugs, tins, holiday packs, minis, and sampler bundles",
  "condition and defect wording such as `blooper bottle`, `broken wax seal`, `low fill`, `opened bottle`, or `damaged box`",
  "retailer SEO words like `Scotch Whisky`, `Kentucky Bourbon Whisky`, or `American Whiskey` when they only restate the category",
  "awards, ratings, tasting notes, review blurbs, and shelf talker copy",
  "retailer names, navigation breadcrumbs, and web-page chrome",
  "shipping, availability, pricing, and legal disclaimers",
];

export const MATCH_COMPONENT_PRIORITY = [
  "brand",
  "separate bottler, when stated",
  "distillery, when known",
  "core expression name",
  "series or range",
  "stated age",
  "edition, batch, barrel code, or release code",
  "category or style",
  "cask type or finish",
  "cask size and cask fill, when stated",
  "single-cask vs batched release",
  "cask-strength or proof-style release",
  "ABV, vintage year, and release year",
];

export const RETAILER_LABEL_EXAMPLES: RetailerLabelExample[] = [
  {
    source: "Total Wine",
    label: "Grangestone Sherry Finish Scotch Whisky",
    notes: [
      "The title omits `single malt` even when the site categorizes it as single malt.",
      "The finish name matters more than the generic `Scotch Whisky` wording.",
    ],
  },
  {
    source: "Total Wine",
    label: "Paul John Mithuna Indian Single Malt Whisky",
    notes: [
      "This is a single malt, but not Scotch.",
      "Do not let retailer navigation or default Scotch assumptions overwrite the actual producer and country style.",
    ],
  },
  {
    source: "Astor Wines",
    label: "Aberfeldy 12 Yr. Single Malt Scotch Whisky",
    notes: [
      "Age is abbreviated as `Yr.`.",
      "When no special expression is present, producer plus age can still identify the bottle.",
    ],
  },
  {
    source: "Astor Wines",
    label: "Ardbeg Uigeadail Single Malt Scotch Whisky",
    notes: [
      "The official expression sits between the producer and generic style words.",
      "Expression extraction should preserve `Uigeadail` and drop the trailing category words.",
    ],
  },
  {
    source: "ReserveBar",
    label: "Maker's Mark Private Selection Kentucky Bourbon Whisky S2B13",
    notes: [
      "The trailing code behaves like an edition or store-pick identifier, not random noise.",
      "Do not collapse distinct barrel or pick codes into the base bottle.",
    ],
  },
  {
    source: "Generic Retailer",
    label: "Springbank 12 Cask Strength Batch 24",
    notes: [
      "Numeric batch wording is reusable release identity under a stable parent bottle.",
      "If no reusable Springbank 12 Cask Strength parent candidate exists locally, prefer `create_bottle_and_release` over `create_release` or `no_match`.",
    ],
  },
  {
    source: "Generic Retailer",
    label: "Heaven's Door Bootleg Vol 3 Whiskey",
    notes: [
      "Bootleg Series is the reusable family, while `Vol 3` is the numbered release identity.",
      "Do not keep the volume number inside the bottle identity when the underlying Bootleg family is clear.",
    ],
  },
  {
    source: "Generic Retailer",
    label: "Four Roses Limited Edition Small Batch 2017",
    notes: [
      "For this family the trailing year is annual release identity, not a fake `Batch 2017` marker.",
      "Do not truncate the bottle into `Four Roses Limited Edition Small` just because `Small Batch` contains the word Batch.",
    ],
  },
  {
    source: "Generic Retailer",
    label: "Highland Park Cask Strength No. 5",
    notes: [
      "`Cask Strength` is the reusable bottle family and `No. 5` is the numbered child release.",
      "If a structured extractor finds `edition = No. 5`, use it to search for the parent instead of forcing the number into the bottle name.",
    ],
  },
  {
    source: "Generic Retailer",
    label: "Lagavulin Distiller's Edition 2023 Islay Single Malt Scotch Whisky",
    notes: [
      "Treat `Distillers Edition` as the stable bottle family even when the retailer uses the apostrophe spelling `Distiller's Edition`.",
      "The bare annual year is release identity here, not part of the parent bottle name.",
      "Apply that same split when the year appears before the family wording, unless the source explicitly says `vintage`, `distilled`, or `distillation`.",
    ],
  },
  {
    source: "ReserveBar",
    label: "Michter's US*1 American Whiskey",
    notes: [
      "Series punctuation is part of the identity and should be preserved.",
      "If the category is unclear from the title alone, leave it `null` instead of forcing a broader fallback.",
    ],
  },
  {
    source: "Wooden Cork",
    label: "Gold Bar Black Double Cask Straight Bourbon Whiskey",
    notes: [
      "The evidence points to the branded expression `Black Double Cask`.",
      "Do not mechanically copy every trailing style word from the retailer title into `expression` or `proposedBottle.name` when the bottle is identified more specifically.",
    ],
  },
  {
    source: "Wooden Cork",
    label: "Skrewball Peanut Butter Whiskey",
    notes: [
      "Unsupported novelty flavored whiskey and whiskey-liqueur products are not genuine whisky records for this database.",
      "Treat peanut butter, PB&J, salted caramel, maple, cinnamon, apple, and similar novelty additive-flavor whiskey products as non-whisky and do not create bottles for them.",
      "Do not overgeneralize this exclusion to every bottle whose expression contains a flavor-adjacent noun. Exclude only when the product itself is clearly the flavored-whiskey or whiskey-liqueur product.",
      "Coffee, cold brew, chocolate, rum, and similar expression words are not automatic exclusion markers by themselves.",
    ],
  },
  {
    source: "Generic Retailer",
    label: "Glenmorangie Quinta Ruban 14-year-old",
    notes: [
      "If the only local candidate adds unsupported release detail like `4th Edition`, treat that candidate as too specific for the listing.",
      "When the parent bottle identity is clear but the local candidate is over-specific, prefer a bottle-level `create_bottle` outcome instead of falsely matching the specific edition.",
    ],
  },
  {
    source: "Generic Retailer",
    label: "Wild Turkey Rare Breed Rye",
    notes: [
      "Retailer titles can omit canonical traits such as `Barrel Proof` even when that trait belongs to the marketed bottle.",
      "Use web evidence to validate the omitted trait, then rerun local bottle search with the enriched structured fields before deciding.",
    ],
  },
  {
    source: "Generic Retailer",
    label: "Elijah Craig Cask Strength",
    notes: [
      "Retailer shorthand can omit the canonical family wording when the official bottle is marketed under a different stable name.",
      "If reliable web evidence shows the family is `Barrel Proof`, match or create the canonical family instead of inventing a separate `Cask Strength` bottle.",
    ],
  },
  {
    source: "Generic Retailer",
    label: "Four Roses Single Barrel Barrel Strength",
    notes: [
      "Generic strength wording appended to an already complete family name is not enough to invent a new canonical bottle or release by itself.",
      "If local and web evidence do not establish a real barrel-strength family, prefer `no_match` over creating a speculative new bottle.",
    ],
  },
  {
    source: "Generic Retailer",
    label: "SMWS RW6.5 Sauna Smoke",
    notes: [
      "For exact-cask programs like SMWS, the cask code is a stronger identity anchor than a conflicting retailer subtitle or selector phrase.",
      "If reliable web evidence confirms the code but reveals a different canonical bottle title, prefer `create_bottle` with `identityScope = exact_cask`, use the evidenced canonical bottle name, and keep the conflicting source subtitle in `observation.selector`.",
    ],
  },
  {
    source: "Official",
    label: "SMWS 6.53",
    notes: [
      "For bare SMWS code references, the code itself is the canonical bottle identity anchor.",
      "Do not replace a bare code-only reference with a web-discovered subtitle when proposing a new bottle.",
    ],
  },
  {
    source: "Official",
    label: "Octomore 13.1",
    notes: [
      "Treat the dotted expression itself as the bottle identity unless local evidence proves a reusable parent bottle already exists.",
      "Do not reinterpret `13.1` as release identity under `Octomore 13` just because the dot looks edition-like.",
    ],
  },
];

const EXTRACTION_EXAMPLES: ExtractionExample[] = [
  {
    input: "Aberfeldy 12 Yr. Single Malt Scotch Whisky",
    output: {
      brand: "Aberfeldy",
      bottler: null,
      expression: null,
      series: null,
      distillery: ["Aberfeldy"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    },
  },
  {
    input: "Jura 12-year-old Scotch Whisky",
    output: {
      brand: "Jura",
      bottler: null,
      expression: null,
      series: null,
      distillery: ["Isle of Jura"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    },
  },
  {
    input: "Maker's Mark Private Selection Kentucky Bourbon Whisky S2B13",
    output: {
      brand: "Maker's Mark",
      bottler: null,
      expression: "Private Selection",
      series: null,
      distillery: ["Maker's Mark"],
      category: "bourbon",
      stated_age: null,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: "S2B13",
    },
  },
  {
    input: "Springbank 12 Cask Strength Batch 24",
    output: {
      brand: "Springbank",
      bottler: null,
      expression: null,
      series: null,
      distillery: ["Springbank"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: true,
      single_cask: null,
      edition: "Batch 24",
    },
  },
  {
    input: "Heaven's Door Bootleg Vol 3 Whiskey",
    output: {
      brand: "Heaven's Door",
      bottler: null,
      expression: "Bootleg Series",
      series: null,
      distillery: [],
      category: "bourbon",
      stated_age: null,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: "Vol. 3",
    },
  },
  {
    input: "Four Roses Limited Edition Small Batch 2017",
    output: {
      brand: "Four Roses",
      bottler: null,
      expression: "Limited Edition Small Batch",
      series: null,
      distillery: ["Four Roses"],
      category: "bourbon",
      stated_age: null,
      abv: null,
      release_year: 2017,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    },
  },
  {
    input: "Highland Park Cask Strength No. 5",
    output: {
      brand: "Highland Park",
      bottler: null,
      expression: "Cask Strength",
      series: null,
      distillery: ["Highland Park"],
      category: "single_malt",
      stated_age: null,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: true,
      single_cask: null,
      edition: "No. 5",
    },
  },
  {
    input: "Lagavulin Distiller's Edition 2023 Islay Single Malt Scotch Whisky",
    output: {
      brand: "Lagavulin",
      bottler: null,
      expression: "Distillers Edition",
      series: null,
      distillery: ["Lagavulin"],
      category: "single_malt",
      stated_age: null,
      abv: null,
      release_year: 2023,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    },
  },
  {
    input: "SMWS 6.53",
    output: {
      brand: "SMWS",
      bottler: null,
      expression: null,
      series: null,
      distillery: [],
      category: null,
      stated_age: null,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: "6.53",
    },
  },
  {
    input: "Octomore 13.1",
    output: {
      brand: "Octomore",
      bottler: null,
      expression: "13.1",
      series: null,
      distillery: ["Bruichladdich"],
      category: "single_malt",
      stated_age: null,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    },
  },
  {
    input: "Paul John Mithuna Indian Single Malt Whisky",
    output: {
      brand: "Paul John",
      bottler: null,
      expression: "Mithuna",
      series: null,
      distillery: ["Paul John"],
      category: "single_malt",
      stated_age: null,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    },
  },
  {
    input: "Gordon & MacPhail Caol Ila 12 Year First Fill Bourbon Cask",
    output: {
      brand: "Gordon & MacPhail",
      bottler: null,
      expression: null,
      series: null,
      distillery: ["Caol Ila"],
      category: null,
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: "First Fill Bourbon",
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    },
  },
  {
    input: "Gold Bar Black Double Cask Straight Bourbon Whiskey",
    output: {
      brand: "Gold Bar",
      bottler: null,
      expression: "Black Double Cask",
      series: null,
      distillery: [],
      category: "bourbon",
      stated_age: null,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    },
  },
  {
    input: "Unknown Bottle Gift Set with 2 Glasses",
    output: null,
  },
  {
    input: "Skrewball Peanut Butter Whiskey",
    output: null,
  },
];

function renderBulletLines(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function renderComponentGuide() {
  return WHISKY_LABEL_COMPONENTS.map(
    (component) =>
      `- ${component.label} -> ${component.outputField}\n${component.guidance
        .map((rule) => `  - ${rule}`)
        .join("\n")}`,
  ).join("\n");
}

function renderRetailerExamples(examples = RETAILER_LABEL_EXAMPLES) {
  return examples
    .map(
      (example) =>
        `- ${example.source}: \`${example.label}\`\n${example.notes
          .map((note) => `  - ${note}`)
          .join("\n")}`,
    )
    .join("\n");
}

function renderExtractionExamples() {
  return EXTRACTION_EXAMPLES.map(
    (example) =>
      `Input: \`${example.input}\`\nOutput:\n\`\`\`json\n${JSON.stringify(
        example.output,
        null,
        2,
      )}\n\`\`\``,
  ).join("\n\n");
}

function renderSchemaRules() {
  return renderBulletLines([
    BOTTLE_SCHEMA_RULES.bottleIdentity,
    BOTTLE_SCHEMA_RULES.releaseIdentity,
    BOTTLE_SCHEMA_RULES.observationPolicy,
    BOTTLE_SCHEMA_RULES.aliasPolicy,
  ]);
}

export function buildWhiskyLabelExtractorInstructions({
  mode,
}: {
  mode: "text" | "image";
}) {
  const modeSpecificRules =
    mode === "image"
      ? [
          "Read only the bottle and label text that is actually visible in the image.",
          "Do not infer missing text from bottle shape, brand colors, or background page elements.",
        ]
      : [
          "Treat the input as source title text that may be retailer-derived, abbreviated, reordered, or incomplete.",
          "Do not assume the source title is canonical just because it is grammatically clean.",
        ];

  return [
    "You extract structured whisky bottle identity from label text and source titles.",
    "Return the best normalized bottle record for the input. If the input is not a whisky bottle reference, return null.",
    "",
    "Mode-specific rules:",
    renderBulletLines(modeSpecificRules),
    "",
    "Bottle identity components:",
    renderComponentGuide(),
    "",
    "Core schema rules:",
    renderSchemaRules(),
    "",
    "Normalization rules:",
    renderBulletLines([
      "For official distillery bottlings, `brand` often matches the single item inside `distillery`, but do not force them to be identical.",
      "Keep the consumer-facing brand when it differs from the producing distillery name. Official single-distillery bottlings such as `Jura` / `Isle of Jura` or `Ledaig` / `Tobermory` are real examples.",
      "For independent bottlings, keep the bottler label in `brand` and the producing distillery in `distillery`.",
      "Use `bottler` only when a separately stated bottler exists in addition to the label brand. If the label brand itself is the bottler, leave `bottler` as `null`.",
      "Prefer `[]` over guessing when the producing distillery is unknown.",
      "When a component is ambiguous, leave it `null` or `[]` instead of guessing. Missing data is better than a fabricated identity signal.",
      "If the source text is clearly for a non-whisky spirit such as vodka, gin, rum, tequila, or mezcal, return `null`.",
      "If the source text is clearly an unsupported novelty flavored whisky, whiskey liqueur, or additive-flavor product such as peanut butter, PB&J, salted caramel, maple, cinnamon, or apple whisky, return `null`.",
      "Do not exclude a bottle solely because the expression contains a flavor-adjacent noun. Official catalogued whisky expressions can still be valid even when the name includes words like coffee, cold brew, chocolate, rum, or port.",
      "Use the flavored-product exclusion narrowly. If the input otherwise reads like a branded whisky bottle identity, keep the structured identity instead of nulling it just because the expression sounds infused or flavor-adjacent.",
      "Treat condition or defect wording such as `blooper bottle`, `broken wax seal`, `low fill`, `opened bottle`, `missing stopper`, or `damaged box` as sale-condition noise, not bottle identity. Do not place it in `expression`, `series`, or `edition`.",
      "Age statements should be integers. Normalize age phrases such as `12 Year`, `12 Years Old`, `12 Yr.`, and `12yr` to `stated_age: 12`.",
      "When an age statement belongs in the expression, normalize the phrase to `12-year-old`.",
      "For expression-style fields, follow the bottle's evidenced canonical name. Do not mechanically append retailer style/category words from the title just to make the expression look complete.",
      "When a stable family phrase is followed by a clearly separate numbered or coded child label, keep the family in `expression` and the varying child label in `edition` instead of collapsing both into one opaque expression.",
      "Apply that split from the label structure itself, not by memorizing brand-specific examples. If the split is ambiguous, stay less specific instead of guessing.",
      "When a stable annual-release family appears with one adjacent bare year and the source does not explicitly say `vintage`, `distilled`, or `distillation`, prefer `release_year` over `vintage_year` even if the year appears before the family wording.",
      "If `edition`, `release_year`, or `vintage_year` is populated, do not also copy that same batch code or year into `expression`.",
      "Use `release_year` only for explicit release or bottling years, not founding dates or warning text.",
      "If both distillation and bottling years are present, use `vintage_year` for the distillation year and `release_year` for the bottling year.",
      "If the source gives proof instead of ABV, convert proof to ABV by dividing by 2 and store only the ABV percentage.",
      "Use `cask_size` and `cask_fill` only when the source text states them explicitly.",
      "Set `cask_strength` and `single_cask` only when the label states them explicitly. `Barrel Strength`, `Barrel Proof`, `Full Proof`, and `Natural Strength` all count as `cask_strength: true`.",
      "Correct obvious whisky-name typos only when the intended bottle is clear from the input.",
    ]),
    "",
    "Retailer noise and packaging to ignore:",
    renderBulletLines(NON_IDENTITY_LABEL_NOISE),
    "",
    "Common retailer failure modes:",
    renderRetailerExamples(),
    "",
    "Output requirements:",
    renderBulletLines([
      "Return only the structured object. Do not add commentary.",
      "Use `null` for missing scalar values.",
      "Use an array for `distillery`; prefer `[]` when the distillery is unknown.",
      "The object fields are `brand`, `bottler`, `expression`, `series`, `distillery`, `category`, `stated_age`, `abv`, `release_year`, `vintage_year`, `cask_type`, `cask_size`, `cask_fill`, `cask_strength`, `single_cask`, and `edition`.",
    ]),
    "",
    "Examples:",
    renderExtractionExamples(),
  ].join("\n");
}

// Prompt design guardrails:
// - Keep this system prompt static so provider-side prompt caching can work.
// - Runtime facts belong in the user input, tool list, tool schemas, and
//   post-model validation, not in dynamically branched system instructions.
// - Do not add eval-engineered examples, brand-by-brand patches, or numeric
//   confidence tuning here. Add durable policy, tool/schema improvements, and
//   eval fixtures that measure evidence quality instead.
const BOTTLE_CLASSIFIER_INSTRUCTIONS = [
  "Task: classify one whisky reference against existing bottle/release candidates.",
  "Return only the structured decision.",
  "",
  "Decision Contract:",
  renderBulletLines([
    "Prefer `no_match` over a false positive match or unsupported create.",
    "Use local candidates first; use web search for disputed, missing, or create-critical traits.",
    "Creation requires supportive web evidence and a refreshed local search when web evidence adds decisive traits.",
    "Match only when an existing bottle or release covers the marketed identity without unsupported extra traits.",
    "Repair only when the current/local target identity is right but stored canonical fields conflict with evidence.",
    "Create the narrowest supported target: bottle, release under an existing clean parent, or bottle plus release.",
    "If evidence maps the source wording to a different canonical product, use that evidenced identity or return `no_match`; do not create a hybrid.",
  ]),
  "",
  "Schema Terms:",
  renderBulletLines([
    BOTTLE_SCHEMA_RULES.bottleIdentity,
    BOTTLE_SCHEMA_RULES.releaseIdentity,
    BOTTLE_SCHEMA_RULES.yearPolicy,
    BOTTLE_SCHEMA_RULES.observationPolicy,
    BOTTLE_SCHEMA_RULES.aliasPolicy,
    "`brand`: consumer-facing label brand.",
    "`bottler`: separately stated bottler only.",
    "`distillery`: producing distillery or distilleries.",
    "`expression`: core bottle name after producer, age, ABV, and generic style words.",
    "`series`: stable range. `edition`: batch, store-pick code, release code, numbered variant.",
    "`category`: house value or `null`; do not force fallback buckets.",
  ]),
  "",
  "Evidence And Candidates:",
  renderBulletLines([
    "Compare components in this order: " +
      MATCH_COMPONENT_PRIORITY.join(", ") +
      ".",
    "Candidates can be bottle or release targets. Use `kind` and `releaseId`.",
    "`familyContext` is evidence about sibling bottles and child releases; it is not a deterministic rule.",
    "Use structured fields first, then names/aliases when structured data is sparse.",
    "Ignore generic words, package text, condition text, retailer SEO, volume, and gift packaging.",
    "Judge web results by specificity, independence, and corroboration, not domain familiarity alone.",
  ]),
  "",
  "Bottle, Release, Exact Cask:",
  renderBulletLines([
    "A parent bottle is the stable marketed product family.",
    "A release is reusable bottling-level identity under a clean parent.",
    "Choose the marketed container: reusable parent with child releases, or a standalone bottle identity.",
    "Use a child release only when evidence shows the expression is a reusable parent with multiple bottlings, releases, batches, vintages, casks, or annual variants. That evidence may come from local candidates, `familyContext`, or external web/source evidence; do not require it to already exist in Peated.",
    "If evidence only supports one known marketed bottling and does not establish a reusable parent expression, keep the differentiating traits on `proposedBottle` instead of creating a child release.",
    "Do not invent a generic parent solely to hold vintage, ABV, cask, or batch facts.",
    "Use `create_release` only when the existing parent bottle is already a clean reusable parent for the proposed release.",
    "If the existing parent bottle carries conflicting bottle-level release traits that must be moved before adding the new release, use `repair_parent_and_create_release` instead of `create_release`.",
    "Use `identityScope = exact_cask` only when the exact cask itself is the marketed bottle identity.",
    "SMWS bottle code is an exact-cask identity anchor; subtitle differences can be observation-level.",
    "For non-SMWS references, exact-cask requires source evidence that the product itself is the single cask, not only incidental cask wording.",
    "Exact-cask identity does not create child releases.",
  ]),
  "",
  "Confidence:",
  renderBulletLines([
    "Fill `confidenceBasis` from the evidence used for the decision.",
    "`auto_verification` requires concrete positive evidence and no unresolved material risk.",
    "If you include any `confidenceBasis.unresolvedRisks`, do not use `confidenceBasis.band = auto_verification`.",
    "Use `current_assignment` only when cleanly reaffirming the current bottle/release assignment.",
    "Name the decisive evidence and material risks, especially candidate conflicts and bottle/release boundary uncertainty.",
    "List only tools actually used in `confidenceBasis.toolsUsed`.",
  ]),
  "",
  "Output:",
  renderBulletLines([
    "`match`: safe existing candidate id.",
    "`repair_bottle`: current bottle identity is right but stored bottle-level facts conflict.",
    "`create_bottle`: new bottle, no reusable child release needed.",
    "`create_release`: existing parent bottle plus supported child release.",
    "`create_bottle_and_release`: new parent plus supported child release.",
    "`repair_parent_and_create_release`: existing parent bottle must be repaired into a clean reusable parent before creating the supported child release. Put the repaired parent draft in `proposedBottle` and the new child release in `proposedRelease`.",
    "`no_match`: no safe whisky match and no web-supported creation. Do not use it for a verified real bottle that is simply missing locally.",
    "Always fill `identityBasis`: stable bottle facts in `bottleTraits`, child-release facts in `releaseTraits`, and source-only facts in `observationTraits`.",
    "Use `identityBasis` to explain any bottle-vs-release or exact-cask boundary decision.",
    "Use `observation` for selector names, cask numbers, bottle numbers, outturn, market/exclusive wording, and exact facts that should not force canonical release split.",
    "For `proposedBottle.name`, use evidenced canonical name, not copied retailer title.",
    "For standalone `create_bottle` decisions, include marketed differentiators such as age, vintage, release year, ABV, cask, batch, or cask-strength wording in `proposedBottle.name` when omitting them would create a weak generic parent.",
    "For `create_bottle`, keep all bottle-level identity traits on `proposedBottle`; if they are child-release traits, use a release action instead.",
    "Return `{ id, name }` objects for `brand`, `distillers`, `bottler`, and `series`; use `id: null` when unknown.",
    "Never invent websites, relationships, release details, or proof numbers.",
  ]),
].join("\n");

export function buildBottleClassifierInstructions(_options: {
  maxSearchQueries: number;
  hasBottleSearch?: boolean;
  hasEntitySearch?: boolean;
}) {
  void _options;
  return BOTTLE_CLASSIFIER_INSTRUCTIONS;
}

const BOTTLE_LOCAL_IDENTIFIER_INSTRUCTIONS = [
  "Task: identify whether one whisky reference safely matches an existing local Peated bottle or release candidate.",
  "Return only the structured decision.",
  "",
  "Decision Contract:",
  renderBulletLines([
    "Return `match` only when an existing local bottle or release candidate safely covers the marketed identity.",
    "Return `no_match` when local evidence is missing, ambiguous, incomplete, or requires web/canonical classification.",
    "Do not create bottles, create releases, repair bottles, repair parents, or infer missing canonical identity.",
    "Do not use or request web evidence. This pass is local-only.",
    "Prefer `no_match` over a false positive local match.",
  ]),
  "",
  "Evidence And Candidates:",
  renderBulletLines([
    "Use local candidates first.",
    "Use structured extracted fields first, then names/aliases when structured data is sparse.",
    "Candidates can be bottle or release targets. Use `kind` and `releaseId`.",
    "`familyContext` is evidence about sibling bottles and child releases; it is not a deterministic rule.",
    "Ignore generic words, package text, condition text, retailer SEO, volume, and gift packaging.",
  ]),
  "",
  "Output:",
  renderBulletLines([
    "`match`: safe existing candidate id.",
    "`no_match`: no safe local existing match. The caller may run full classification.",
    "Always fill `identityBasis` and `confidenceBasis` from local evidence only.",
    "Set `confidenceBasis.webEvidence = not_used` or `not_needed`; never use `supportive`.",
    "List only local tools actually used in `confidenceBasis.toolsUsed`.",
  ]),
].join("\n");

export function buildBottleLocalIdentifierInstructions() {
  return BOTTLE_LOCAL_IDENTIFIER_INSTRUCTIONS;
}
