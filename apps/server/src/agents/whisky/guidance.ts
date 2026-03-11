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
  "`spirit`",
].join(", ");

export const WHISKY_LABEL_COMPONENTS: WhiskyLabelComponent[] = [
  {
    id: "producer",
    label: "Producer / bottler",
    outputField: "`brand`",
    guidance: [
      "Use the most prominent producer on the label.",
      "For official distillery releases, `brand` is usually the distillery name.",
      "For independent bottlings, `brand` is the bottler and the actual producer belongs in `distillery`.",
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
      "Use this for batch labels, store-pick codes, release identifiers, or numbered editions such as `Batch 3`, `2021 Release`, or `S2B13`.",
      "Treat short suffix codes as meaningful bottle identity when they look like a batch or store-pick marker.",
    ],
  },
  {
    id: "category",
    label: "Category / style",
    outputField: "`category`",
    guidance: [
      `Normalize into one of ${CATEGORY_VALUES}.`,
      "Use `spirit` as a fallback for whiskies that do not map cleanly to the narrower house categories.",
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
      "Capture the primary cask or finish wording when it is part of the bottle identity.",
      "Keep descriptive phrases such as `First Fill Bourbon`, `PX Cask Finish`, or `Oloroso Sherry`.",
    ],
  },
  {
    id: "strength",
    label: "Strength and barrel flags",
    outputField: "`cask_strength`, `single_cask`",
    guidance: [
      "Set `cask_strength` to true only when the label explicitly says cask strength, barrel proof, full proof, natural strength, or similar.",
      "Set `single_cask` to true only when the label explicitly says single cask, single barrel, or a specific cask/barrel selection.",
    ],
  },
  {
    id: "technical",
    label: "Technical details",
    outputField: "`abv`, `vintage_year`, `release_year`",
    guidance: [
      "ABV is the numeric alcohol percentage.",
      "Use `vintage_year` for the distillation year and `release_year` for the bottling or release year.",
    ],
  },
];

export const NON_IDENTITY_LABEL_NOISE = [
  "volume and pack size such as `50ml`, `750ml`, `1L`, or `1.75L`",
  "gift sets, glasses, mugs, tins, holiday packs, minis, and sampler bundles",
  "retailer SEO words like `Scotch Whisky`, `Kentucky Bourbon Whisky`, or `American Whiskey` when they only restate the category",
  "awards, ratings, tasting notes, review blurbs, and shelf talker copy",
  "retailer names, navigation breadcrumbs, and web-page chrome",
  "shipping, availability, pricing, and legal disclaimers",
];

export const MATCH_COMPONENT_PRIORITY = [
  "producer or bottler",
  "distillery, when known",
  "core expression name",
  "series or range",
  "stated age",
  "edition, batch, barrel code, or release code",
  "category or style",
  "cask type or finish",
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
    source: "ReserveBar",
    label: "Michter's US*1 American Whiskey",
    notes: [
      "Series punctuation is part of the identity and should be preserved.",
      "The category is broader than bourbon or rye, so `spirit` can be the right normalized fallback.",
    ],
  },
];

const EXTRACTION_EXAMPLES: ExtractionExample[] = [
  {
    input: "Aberfeldy 12 Yr. Single Malt Scotch Whisky",
    output: {
      brand: "Aberfeldy",
      expression: null,
      series: null,
      distillery: ["Aberfeldy"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    },
  },
  {
    input: "Maker's Mark Private Selection Kentucky Bourbon Whisky S2B13",
    output: {
      brand: "Maker's Mark",
      expression: "Private Selection",
      series: null,
      distillery: ["Maker's Mark"],
      category: "bourbon",
      stated_age: null,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: "S2B13",
    },
  },
  {
    input: "Paul John Mithuna Indian Single Malt Whisky",
    output: {
      brand: "Paul John",
      expression: "Mithuna",
      series: null,
      distillery: ["Paul John"],
      category: "single_malt",
      stated_age: null,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    },
  },
  {
    input: "Gordon & MacPhail Caol Ila 12 Year First Fill Bourbon Cask",
    output: {
      brand: "Gordon & MacPhail",
      expression: null,
      series: null,
      distillery: ["Caol Ila"],
      category: null,
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: "First Fill Bourbon",
      cask_strength: null,
      single_cask: null,
      edition: null,
    },
  },
  {
    input: "Unknown Bottle Gift Set with 2 Glasses",
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

function renderRetailerExamples() {
  return RETAILER_LABEL_EXAMPLES.map(
    (example) =>
      `- ${example.source}: \`${example.label}\`\n${example.notes
        .map((note) => `  - ${note}`)
        .join("\n")}`,
  ).join("\n");
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
          "Treat the input as retailer title text that may be abbreviated, reordered, or incomplete.",
          "Do not assume the store title is canonical just because it is grammatically clean.",
        ];

  return [
    "You extract structured whisky bottle identity from label text and retailer listing titles.",
    "Return the best normalized bottle record for the input. If the input is not a whisky bottle listing, return null.",
    "",
    "Mode-specific rules:",
    renderBulletLines(modeSpecificRules),
    "",
    "Bottle identity components:",
    renderComponentGuide(),
    "",
    "Normalization rules:",
    renderBulletLines([
      "For official distillery bottlings, `brand` usually matches the single item inside `distillery`.",
      "For independent bottlings, keep the bottler in `brand` and the producing distillery in `distillery`.",
      "Prefer `[]` over guessing when the producing distillery is unknown.",
      "When a component is ambiguous, leave it `null` or `[]` instead of guessing. Missing data is better than a fabricated identity signal.",
      "Age statements should be integers. Normalize age phrases such as `12 Year`, `12 Years Old`, `12 Yr.`, and `12yr` to `stated_age: 12`.",
      "When an age statement belongs in the expression, normalize the phrase to `12-year-old`.",
      "Use `release_year` only for explicit release or bottling years, not founding dates or warning text.",
      "If both distillation and bottling years are present, use `vintage_year` for the distillation year and `release_year` for the bottling year.",
      "Set `cask_strength` and `single_cask` only when the label states them explicitly.",
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
      "The object fields are `brand`, `expression`, `series`, `distillery`, `category`, `stated_age`, `abv`, `release_year`, `vintage_year`, `cask_type`, `cask_strength`, `single_cask`, and `edition`.",
    ]),
    "",
    "Examples:",
    renderExtractionExamples(),
  ].join("\n");
}

export function buildStorePriceMatchInstructions({
  maxSearchQueries,
}: {
  maxSearchQueries: number;
}) {
  return [
    "You are classifying a scraped spirits retailer listing against an existing bottle database.",
    "Decide whether the listing matches the current bottle, another candidate, a new bottle, or nothing in the candidate set.",
    "",
    "Available tools:",
    renderBulletLines([
      "Use `search_bottles` to query the local bottle database with hybrid retrieval. Prefer this before web search when you need more candidates.",
      "Use `search_entities` to query local producers, distilleries, and bottlers when you need to resolve `brand` or `distillery` identity.",
      "Use `openai_web_search` only after local search is still ambiguous or conflicting.",
    ]),
    "",
    "House schema conventions:",
    renderBulletLines([
      "`brand` is the producer or bottler shown most prominently on the label.",
      "`distillery` is the actual producing distillery or distilleries. For independent bottlings, `brand` and `distillery` often differ.",
      "`expression` is the core release name after removing producer, age, ABV, and generic style words.",
      "`series` is a stable range or family. `edition` is a batch, store-pick code, release code, or numbered variant.",
      "`category` should be normalized to the house values. `spirit` is a fallback when the whisky style is broader than bourbon, rye, or the Scotch-focused categories.",
      "`cask_strength` and `single_cask` are true only when the listing states them explicitly.",
      "If a decisive component is missing or ambiguous, treat that as uncertainty instead of inventing a cleaner canonical label.",
    ]),
    "",
    "Decision process:",
    renderBulletLines([
      "Prefer local evidence first: current assignment, exact aliases, vector candidates, text candidates, brand candidates, extracted label details, and local search tools.",
      "When there is no strong direct match in the provided input, start by calling `search_bottles` with the most specific query you can form from the listing and extracted label.",
      "Compare the listing against candidate bottles component by component in this order: " +
        MATCH_COMPONENT_PRIORITY.join(", ") +
        ".",
      "Use `search_bottles` iteratively when the first candidate set is thin or missing obvious near matches.",
      "Use `search_entities` when brand, distillery, or bottler identity is unclear and that ambiguity blocks a decision.",
      "For independent bottlings, evaluate `brand` and `distillery` separately because the bottler and producer can differ.",
      "Treat differences in age, edition code, store-pick code, cask finish, single-cask status, or cask-strength status as meaningful bottle identity unless the evidence clearly shows retailer noise.",
      "Do not reject a candidate solely because the extracted category is `spirit`; that is a coarse fallback category.",
      "Missing generic style words like `single malt` are weak evidence. Conflicting age statements, edition codes, or barrel descriptors are strong evidence.",
      "Ignore volume, gift-set packaging, added glassware, ratings blurbs, and generic retailer SEO words when deciding bottle identity.",
    ]),
    "",
    "Common retailer failure modes:",
    renderRetailerExamples(),
    "",
    "Search policy:",
    renderBulletLines([
      "Use `openai_web_search` only when local evidence is ambiguous, conflicting, or suggests the current assignment is wrong.",
      "When searching, prioritize the retailer domain first, then producer or distiller domains, then broader web if still unresolved.",
      `You have a hard limit of ${maxSearchQueries} search calls.`,
    ]),
    "",
    "Output rules:",
    renderBulletLines([
      "A false positive match is worse than returning `no_match` or a lower-confidence review candidate.",
      "Return `create_new` only when the listing clearly represents a bottle that is not already present in the candidate set.",
      "If the current bottle assignment is likely wrong, return `correction`.",
      "If the current bottle assignment is likely correct and confidence is high, return `match_existing` with that bottle id.",
      "If identity evidence is weak, conflicting, or missing on the decisive components, do not force a match.",
      "Set `confidence` as a percentage from 0 to 100, not a 0-1 decimal.",
      "Only set `suggestedBottleId` to an id from the provided candidates.",
      "If you return `create_new`, `proposedBottle` must include every schema field, using `null` or `[]` when unknown.",
      "For `brand`, `distillers`, `bottler`, and `series`, return objects with `{ id, name }`. Use `id: null` when you do not know a local id.",
      "Never invent websites, producer relationships, release details, or missing proof numbers.",
    ]),
  ].join("\n");
}
