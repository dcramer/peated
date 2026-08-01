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
    id: "strength",
    label: "Strength and barrel flags",
    outputField: "`cask_strength`, `single_cask`",
    guidance: [
      "Set `cask_strength` to true only when the label explicitly says cask strength, barrel strength, barrel proof, full proof, natural strength, or similar.",
      "A single-cask or single-barrel label with a concrete cask/barrel number and very high bottle strength, such as 55%+ ABV or 110+ proof, can also be treated as cask-strength when that is the visible bottling presentation.",
      "Set `single_cask` to true only when the label explicitly says single cask, single barrel, or a specific cask/barrel selection.",
    ],
  },
  {
    id: "technical",
    label: "Technical details",
    outputField: "`abv`, `vintage_year`, `release_year`",
    guidance: [
      "ABV is the numeric alcohol percentage.",
      "If the source gives proof instead of ABV, convert proof to ABV by dividing by 2. Never copy a proof number directly into `abv`.",
      "Use `vintage_year` for the distillation year and `release_year` for the bottling or release year.",
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
      "Numeric batch wording is exact marketed Bottle identity.",
      "Preserve `Batch 24` in the complete Bottle draft rather than inventing or selecting a parent/group relationship.",
    ],
  },
  {
    source: "Generic Retailer",
    label: "Heaven's Door Bootleg Vol 3 Whiskey",
    notes: [
      "Bootleg Series is the stable range, while `Vol 3` distinguishes the exact marketed Bottle.",
      "Keep the volume number on the complete Bottle rather than selecting or creating a parent/group relationship.",
    ],
  },
  {
    source: "Generic Retailer",
    label: "Four Roses Limited Edition Small Batch 2017",
    notes: [
      "For this family the trailing year distinguishes the exact annual Bottle, not a fake `Batch 2017` marker.",
      "Do not truncate the bottle into `Four Roses Limited Edition Small` just because `Small Batch` contains the word Batch.",
    ],
  },
  {
    source: "Generic Retailer",
    label: "Highland Park Cask Strength No. 5",
    notes: [
      "`Cask Strength No. 5` is the complete marketed Bottle identity, with `No. 5` retained as its edition.",
      "If a structured extractor finds `edition = No. 5`, use it to search for that exact Bottle rather than selecting a parent or group.",
    ],
  },
  {
    source: "Generic Retailer",
    label: "Lagavulin Distiller's Edition 2023 Islay Single Malt Scotch Whisky",
    notes: [
      "Treat `Distillers Edition` as the stable bottle family even when the retailer uses the apostrophe spelling `Distiller's Edition`.",
      "The bare annual year is exact Bottle identity here and belongs on the complete Bottle draft.",
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
    source: "Official",
    label: "Octomore 13.1",
    notes: [
      "Treat the dotted expression itself as the complete Bottle identity.",
      "Do not reinterpret `13.1` as a nested version under `Octomore 13` just because the dot looks edition-like.",
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
      cask_strength: null,
      single_cask: null,
      edition: null,
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
    BOTTLE_SCHEMA_RULES.exactBottleIdentity,
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
          "Scan the complete readable label, including smaller secondary bands, subtitles, and neck tags, for identity-bearing edition, batch, release, finish, and variant text.",
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
      "When the visible label, capsule, or neck tag explicitly names a producer with `Distillery` in the name, include that producer in `distillery` even if the front brand is a shorter consumer label.",
      "Prefer `[]` over guessing when the producing distillery is unknown.",
      "When a component is ambiguous, leave it `null` or `[]` instead of guessing. Missing data is better than a fabricated identity signal.",
      "For exact-cask labels, combine a visible cask or barrel code and prominent title into `expression` when both are part of the marketed identity; keep tasting-note prose out of `expression`.",
      "If a visible label explicitly says `American Single Malt Whiskey`, `Single Malt Scotch Whisky`, or equivalent single-malt wording, return `category: single_malt`.",
      "Do not reject a grain-based whisky-style bottle solely because the visible label says `spirit`, `spirits`, or `spirits distilled from grain`; reject only when it clearly names a non-whisky spirit type such as vodka, gin, rum, tequila, or mezcal.",
      "If the source text is clearly for a non-whisky spirit such as vodka, gin, rum, tequila, or mezcal, return `null`.",
      "If the source text is clearly an unsupported novelty flavored whisky, whiskey liqueur, or additive-flavor product such as peanut butter, PB&J, salted caramel, maple, cinnamon, or apple whisky, return `null`.",
      "Do not exclude a bottle solely because the expression contains a flavor-adjacent noun. Official catalogued whisky expressions can still be valid even when the name includes words like coffee, cold brew, chocolate, rum, or port.",
      "Use the flavored-product exclusion narrowly. If the input otherwise reads like a branded whisky bottle identity, keep the structured identity instead of nulling it just because the expression sounds infused or flavor-adjacent.",
      "Treat condition or defect wording such as `blooper bottle`, `broken wax seal`, `low fill`, `opened bottle`, `missing stopper`, or `damaged box` as sale-condition noise, not bottle identity. Do not place it in `expression`, `series`, or `edition`.",
      "Age statements should be integers. Normalize age phrases such as `12 Year`, `12 Years Old`, `12 Yr.`, and `12yr` to `stated_age: 12`.",
      "When an age statement belongs in the expression, normalize the phrase to `12-year-old`.",
      "For expression-style fields, follow the bottle's evidenced canonical name. Do not mechanically append retailer style/category words from the title just to make the expression look complete.",
      "Keep marketed `Single Barrel` or `Single Cask` wording in `expression` when it is printed as part of the bottle name; setting `single_cask: true` does not remove that wording from the name.",
      "When a stable family phrase is followed by a clearly separate numbered or coded variant label, keep the family in `expression` and the varying label in `edition` instead of collapsing both into one opaque expression.",
      "Apply that split from the label structure itself, not by memorizing brand-specific examples. If the split is ambiguous, stay less specific instead of guessing.",
      "When a bare year appears before the stable family wording, prefer `vintage_year` unless the source explicitly says release or bottling year. When the year appears after an annual-release family name, prefer `release_year`.",
      "If `edition`, `release_year`, or `vintage_year` is populated, do not also copy that same batch code or year into `expression`.",
      "Use `release_year` only for explicit release or bottling years, not founding dates or warning text.",
      "If both distillation and bottling years are present, use `vintage_year` for the distillation year and `release_year` for the bottling year.",
      "If the source gives proof instead of ABV, convert proof to ABV by dividing by 2 and store only the ABV percentage.",
      "Keep cask or finish wording in the bottle name, expression, or edition when it is part of the marketed identity. Also populate canonical `cask_type`, `cask_size`, and `cask_fill` when the label explicitly supports them; leave those fields null instead of guessing from broad finish language.",
      "Set `cask_strength` and `single_cask` only when the label states them explicitly. `Barrel Strength`, `Barrel Proof`, `Full Proof`, and `Natural Strength` all count as `cask_strength: true`.",
      "A specific `Cask No.` or `Barrel No.` on a single-bottle whisky label counts as `single_cask: true` when the label presents it as the source barrel/cask identity.",
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
      "The object fields are `brand`, `bottler`, `expression`, `series`, `distillery`, `category`, `stated_age`, `abv`, `release_year`, `vintage_year`, `cask_strength`, `single_cask`, `cask_type`, `cask_size`, `cask_fill`, and `edition`.",
    ]),
    "",
    "Examples:",
    renderExtractionExamples(),
  ].join("\n");
}
