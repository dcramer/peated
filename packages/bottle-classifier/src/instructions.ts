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

export const MATCH_COMPONENT_PRIORITY = [
  "brand",
  "separate bottler, when stated",
  "distillery, when known",
  "core expression name",
  "series or range",
  "stated age",
  "edition, batch, barrel code, or release code",
  "category or style",
  "marketed finish or variant wording",
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
      "If the parent bottle identity is clear and the only local candidate adds an unsupported canonical release marker such as `4th Edition`, prefer a bottle-level `create_bottle` outcome instead of falsely matching the specific edition.",
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
      "When a stable family phrase is followed by a clearly separate numbered or coded child label, keep the family in `expression` and the varying child label in `edition` instead of collapsing both into one opaque expression.",
      "Apply that split from the label structure itself, not by memorizing brand-specific examples. If the split is ambiguous, stay less specific instead of guessing.",
      "When a bare year appears before the stable family wording, prefer `vintage_year` unless the source explicitly says release or bottling year. When the year appears after an annual-release family name, prefer `release_year`.",
      "If `edition`, `release_year`, or `vintage_year` is populated, do not also copy that same batch code or year into `expression`.",
      "Use `release_year` only for explicit release or bottling years, not founding dates or warning text.",
      "If both distillation and bottling years are present, use `vintage_year` for the distillation year and `release_year` for the bottling year.",
      "If the source gives proof instead of ABV, convert proof to ABV by dividing by 2 and store only the ABV percentage.",
      "Keep cask or finish wording in the bottle name, expression, edition, or rationale when it is part of the marketed identity; do not normalize it into separate cask type, size, or fill fields.",
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
      "The object fields are `brand`, `bottler`, `expression`, `series`, `distillery`, `category`, `stated_age`, `abv`, `release_year`, `vintage_year`, `cask_strength`, `single_cask`, and `edition`.",
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
  "Task And Success Criteria:",
  "Task: classify one whisky reference against existing bottle/release (bottling) candidates.",
  "Return only the structured decision.",
  renderBulletLines([
    "Prefer `no_match` over a false positive match or unsupported create.",
    "`no_match` means the bottle/release identity is unresolved or creation would invent an ambiguous hybrid. Do not use `no_match` merely because a clear identity has catalog enrichment or repair follow-up.",
  ]),
  "",
  "Input Map:",
  renderBulletLines([
    "Candidates can be bottle or release/bottling targets. Use `kind` and `releaseId`.",
    "`familyContext` is evidence about sibling bottles and child bottlings; it is not a deterministic rule.",
  ]),
  "",
  "Bottle Identity Model:",
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
    "A parent bottle is the stable marketed product family.",
    "A release is the schema term for a reusable child bottling under a clean parent.",
    "Choose the marketed container: reusable parent with child bottlings, or a standalone bottle identity.",
    "Use a child release/bottling only when the source or candidates provide concrete reusable bottling identity: edition, batch, volume/chapter, release/bottling year, vintage/distillation year, ABV, cask-strength plus a concrete batch/pick/recipe/barrel marker, single-cask plus a concrete cask/pick marker, or a specific release under a named program.",
    "A batch/edition marker that appears in the product's sold name — the retailer listing title, product page name, or the marketed display name on the label, meaning the brand/expression/marketed-trait text the label presents as the product's name — is marketed release identity by default, because retailers title by what they sell; distinct SKUs, per-batch specs, and sibling marker rows in the catalog are supporting evidence, not requirements. A code printed on the label apart from that display name — back label, fill details, or a year-prefixed run format such as a two-digit-year alphanumeric — is not sold-name evidence by itself; it is a lot code unless there is evidence the product is sold by that code, including for photo-only inputs where the label is the only name source. Lot codes are observations for the `observation` field and never force a bottle or release split. Cask/barrel numbers on single-cask or single-barrel products are exact-cask identity, never lot codes.",
    "If the source names only the parent family and omits the concrete batch/year/chapter/volume/bottling marker, match or create the parent bottle only; do not create an empty or minimal child release just because web evidence says releases exist, and do not abstain solely because the family also has batch-specific releases.",
    "When a stable family name has a concrete bottling marker, keep the family on the bottle and the marker on the release/bottling instead of flattening both into one bottle name.",
    "Chapter, volume, part, batch, and annual labels under the same named series are bottling markers when sibling rows vary only by that marker; exact chapter-specific bottle rows are legacy bottling rows, not safe parent matches.",
    "When a year is attached to a stable family name, keep it as child bottling identity even if no parent exists yet; use release/bottling year unless source wording or stronger evidence says vintage/distillation year. Year-role ambiguity changes which release field you fill, not whether a web-supported family plus year can be created.",
    "Age alone does not make a child bottling. When an exact age-stated bottle row exists and there is no batch, year, edition, existing child release, or authoritative recurring-bottling evidence for that family, match the age-stated bottle instead of inventing an age release under an age-less parent.",
    "Cask-strength, barrel-proof, barrel-strength, full-proof, and single-barrel wording alone can be stable bottle identity; do not create a child bottling from strength wording unless the source also has a concrete batch, year, recipe, barrel, pick, ABV, or program marker.",
    "If a barrel-strength single-barrel/private-selection style reference lacks the concrete recipe, pick, barrel, ABV, or selector needed to identify a bottling, use `no_match` rather than creating a generic standalone bottle.",
    "Existing child releases/bottlings under a broad candidate prove bottling capacity, not parent suitability; the parent must cover the marketed family without omitting a decisive expression, finish, or variant.",
    "Keep stable expression, finish, or variant wording on `proposedBottle` unless evidence makes it a reusable bottling marker under a plainer parent.",
    "Do not add age, vintage, year, cask, or batch facts to `proposedBottle` just because web results mention them. Use web evidence to confirm the canonical product, but keep `proposedBottle` scoped to source-supported bottle identity; standalone exact-cask bottles and weak generic-parent avoidance are the narrow exceptions below.",
    "Do not invent a generic parent solely to hold vintage, ABV, cask, or batch facts.",
    "Use `identityScope = exact_cask` only when the exact cask itself is the marketed bottle identity.",
    "Exact-cask requires source evidence that the product itself is the single cask, not only incidental cask wording.",
    "Exact-cask identity does not create child releases/bottlings.",
  ]),
  "",
  "Evidence Policy And Tool Use:",
  renderBulletLines([
    "Compare components in this order: " +
      MATCH_COMPONENT_PRIORITY.join(", ") +
      ".",
    "Use structured fields first, then names/aliases when structured data is sparse.",
    "Ignore generic words, package text, condition text, retailer SEO, volume, and gift packaging.",
    "Judge web results by specificity, independence, and corroboration, not domain familiarity alone.",
  ]),
  "",
  "Decision Workflow:",
  "Run these steps in order; an earlier step's outcome takes precedence over a later one.",
  renderBulletLines([
    "1. Resolve source identity before catalog outcome: identify the bottle family plus exact release/bottling details, then decide whether that exact target already exists or needs creation. Use local Peated candidates like prior-art evidence: they show existing targets and modeling patterns, but they must not collapse a clear source bottling into a broader or wrong nearby row.",
    "2. Classify any observed batch/code marker before choosing scope: a marker in the product's sold name (retailer listing title, product page name, or the marketed display name on the label — the text the label presents as the product's name) is marketed release identity by default; a code printed on the label apart from that display name is not sold-name evidence by itself and, including for photo-only inputs, is a lot code unless there is evidence the product is sold by it — leaving the plain marketed product as the observed identity, with the code in `observation`. Then classify the observed scope before trusting exact-name candidates: standalone bottle, release/bottling under a stable parent, exact-cask bottle, or unresolved. A marketed marker means the observed identity is a release under a stable parent family, so an exact-name bottle row that carries that marker in its own name is a legacy bottling row, not the stable parent and not a reusable release.",
    "3. Use local candidates first; use web search for disputed, missing, or create-critical traits. When a finish, expression, or variant separates close candidates, search contrastively for the source wording and the plainer candidate identity. Prefer broad unquoted product-word queries over exact quoted retailer titles.",
    "4. Creation requires supportive web evidence and a local candidate check that covers decisive traits; rerun local search when web evidence reveals a decisive trait not already covered by provided candidates.",
    "5. Match only a candidate that covers the observed identity at the same precision layer with no conflicting canonical traits. For an observed release under a parent, match a release candidate that covers that parent and marker (return `matchedBottleId` and `matchedReleaseId`), or match the stable parent bottle when the observed release traits are not reusable; for an observed standalone or exact-cask bottle, match a bottle candidate whose stable identity matches. Matching an existing target is preferred over creating a duplicate, but a legacy bottle row that carries the observed release marker in its own name is not that target; redirect its release to a clean parent in the create step instead of matching the flattened row. When the observed code is a lot code, the plain marketed product row is the target even when a flattened lot-code row exists; match the plain row, carry the code in `observation`, and leave the flattened lot-code row to downstream catalog repair.",
    "6. Do not match an over-specific or wrong-layer candidate. Do not match a candidate whose name adds a release, age, year, cask, barrel, outturn, selector, or edition trait that the source lacks when evidence also supports the plainer product identity; the absence of a cleaner local row means create the supported identity, not match the narrower coded row.",
    "7. Repair only when the current/local target identity is right but stored canonical fields make that target identity unsafe. Missing optional facts or cleanup opportunities are downstream enrichment; do not let them block match/create.",
    "8. When no candidate matches, create the narrowest supported target: bottle, release under an existing clean parent, or bottle plus release (see Action Semantics for parent selection). When a marketed marker's family has no clean parent — only flattened marker-in-name rows, or no local rows at all — create the parent plus release (`create_bottle_and_release`); never collapse the marker into a standalone bottle name. A flattened marker row is a match target only when it is the only representation of the marketed product and there is no reusable-family evidence such as multiple marker siblings, existing child releases, or a web-proven recurring series; otherwise reuse an existing clean parent or existing release to avoid duplicate creation.",
    "9. If evidence maps the source wording to a different canonical product, use that evidenced identity or return `no_match`; do not create a hybrid.",
  ]),
  "",
  "Action Semantics:",
  renderBulletLines([
    "Choose the parent by cleaned family identity, not by highest score alone: use a clean parent candidate when present, otherwise a dirty same-family row that becomes the parent by removing its release markers. A clean parent candidate present means `create_release`, never `repair_parent_and_create_release`; dirty sibling rows prove release modeling but do not make the clean parent dirty.",
    "`match`: an existing bottle or release/bottling already covers the marketed identity at the correct precision layer. Return `matchedBottleId` and, for release matches, `matchedReleaseId`.",
    "`repair_bottle`: an existing bottle is the right identity but its stored canonical fields make that identity unsafe. Return `matchedBottleId` and the repaired `proposedBottle`. Do not choose `repair_bottle` only to fill missing optional facts such as ABV or to remove questionable non-target-defining metadata; use `match` and leave enrichment/cleanup to downstream repair work.",
    "`create_bottle`: the source supports a new standalone bottle and no reusable child bottling is needed. Return `proposedBottle` only.",
    "`create_release`: a clean existing parent bottle should receive a new child bottling. Return that clean parent as `parentBottleId`, not a dirty/exact child-like row, plus `proposedRelease`. A clean parent plus sibling releases that prove the marker type is enough to create the release even when web evidence is unavailable.",
    "`create_bottle_and_release`: the source supports a stable parent bottle and a child bottling under it, but no existing candidate can serve as the clean parent. Return both `proposedBottle` and `proposedRelease`, with the marker on `proposedRelease`, not in `proposedBottle.name`; when only legacy same-family marker rows exist and share a clear reusable family, this outcome is supported rather than `no_match`.",
    "`repair_parent_and_create_release`: no clean parent candidate exists and a dirty same-family row becomes the family parent by removing its bottling-specific traits. Return `parentBottleId`, the repaired parent `proposedBottle`, and `proposedRelease`.",
    "`no_match`: there is no safe existing target and no supported create action, or creating would invent an ambiguous hybrid.",
  ]),
  "",
  "Output Contract:",
  renderBulletLines([
    "Always fill `aliasScope`.",
    "`aliasScope = global_alias` only when the listing title itself is safe as a reusable bottle alias.",
    "`aliasScope = none` when no reusable global alias should be created; use it for generic, underspecified, source-specific, or otherwise unsafe listing titles.",
    "Do not infer alias safety from brand prefixes, retailer domain names, title shape, `single barrel` wording, search rank, or sibling family snippets. Use the reviewed evidence in this run.",
    "Fill `confidenceBasis` from the evidence used: `positiveEvidence`, `unresolvedRisks`, `toolsUsed`, and `webEvidence`. Record a reaffirmation of the reference's current bottle/release assignment as positive evidence, not as a risk.",
    "Each `confidenceBasis.unresolvedRisks` entry is a `category` plus a short `note`. Categories: `trait_conflict`, `sibling_ambiguity`, `release_ambiguity`, `web_evidence_conflict`, `insufficient_evidence`, `identity_ambiguity`, or `other` for a holistic concern no category fits. Leave the list empty to assert no material risk; any risk routes the decision to review and no risk can upgrade it.",
    "Only list risks that could change the action or target; missing optional ABV, distillery, producer-controlled source evidence, minor equivalent name wording, or hypothetical future siblings are not material when they are not needed to distinguish the target.",
    "When an exact-cask code anchors the match, the code decides the target: a subtitle or nickname missing from the source label, or incomplete optional metadata on the matched candidate, cannot make a matching code ambiguous and is not an unresolved risk.",
    "For a readable uploaded label photo, label-visible exact barrel/cask, age, ABV, and edition details are primary source evidence. Lack of independent web corroboration for that exact private barrel or scene is not material when local candidates do not already cover the visible identity.",
    "Do not put equivalent finish, variant, or expression wording differences in `confidenceBasis.unresolvedRisks` when evidence shows they refer to the same marketed identity; mention them in the rationale only if useful.",
    "Do not put an existing candidate's source-absent year, ABV, or other optional stored metadata in `confidenceBasis.unresolvedRisks` when the candidate otherwise covers the source identity; that is catalog enrichment or cleanup, not an identity risk.",
    "Do not put future catalog modeling ideas in `confidenceBasis.unresolvedRisks`, such as that the product may later become a parent with coded child releases, unless an existing candidate currently provides that parent/release target.",
    "Name the decisive evidence and material risks, especially candidate conflicts. Bottle-vs-bottling boundary uncertainty is material only when an existing plausible parent or release target could change the action; do not list speculative future modeling as an unresolved risk for a web-supported standalone product creation.",
    "List only tools actually used in `confidenceBasis.toolsUsed`.",
    "Always fill `identityBasis`: stable bottle facts in `bottleTraits`, child bottling facts in `releaseTraits`, and source-only facts in `observationTraits`.",
    "Use `identityBasis` to explain any bottle-vs-bottling or exact-cask boundary decision.",
    "Verify selected ids match the rationale: if you identify a clean parent, `parentBottleId` must be that clean parent, not the dirty sibling.",
    "Use `observation` for selector names, cask numbers, bottle numbers, outturn, market/exclusive wording, and exact facts that should not force canonical release split.",
    "For `proposedBottle.name`, use evidenced canonical name, not copied retailer title.",
    "For `proposedRelease`, carry over source-supported structured release fields from extraction, including `releaseYear`, unless the rationale explains why the extracted field is not identity.",
    "For standalone `create_bottle` decisions, include marketed differentiators such as age, vintage, release year, finish, cask code, batch, or cask-strength wording in `proposedBottle.name` when omitting them would create a weak generic parent. Keep ABV in the structured `abv` field, not in `proposedBottle.name`.",
    "For standalone `create_bottle` with `identityScope = exact_cask`, put source-stated age, ABV, vintage year, cask-strength, and single-cask flags on `proposedBottle` because the exact bottling is the bottle identity; include source-marketed age and vintage year in `proposedBottle.name` so the display name is not a weak generic parent. Keep ABV in the structured `abv` field, not in `proposedBottle.name`.",
    "For standalone `create_bottle`, do not fill `proposedBottle.statedAge` from web-only evidence when the extracted source identity has no age and no local candidate conflict requires the age.",
    "For `create_bottle`, keep all bottle-level identity traits on `proposedBottle`; if they are child bottling traits, use a release action instead.",
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
