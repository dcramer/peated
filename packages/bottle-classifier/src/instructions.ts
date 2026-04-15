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
      "For official distillery releases, `brand` is usually the distillery name.",
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
      "Use this for batch labels, store-pick codes, release identifiers, or numbered editions such as `Batch 3`, `2021 Release`, or `S2B13`.",
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
      "Novelty flavored whiskey products are not genuine whisky records for this database.",
      "Treat peanut butter, PB&J, salted caramel, maple, honey, cinnamon, apple, and similar flavored whiskey products as non-whisky and do not create bottles for them.",
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
    label: "SMWS RW6.5 Sauna Smoke",
    notes: [
      "For exact-cask programs like SMWS, the cask code is a stronger identity anchor than a conflicting retailer subtitle or selector phrase.",
      "If authoritative web evidence confirms the code but reveals a different canonical bottle title, prefer `create_bottle` with `identityScope = exact_cask`, use the evidenced canonical bottle name, and keep the conflicting source subtitle in `observation.selector`.",
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
      "For official distillery bottlings, `brand` usually matches the single item inside `distillery`.",
      "For independent bottlings, keep the bottler label in `brand` and the producing distillery in `distillery`.",
      "Use `bottler` only when a separately stated bottler exists in addition to the label brand. If the label brand itself is the bottler, leave `bottler` as `null`.",
      "Prefer `[]` over guessing when the producing distillery is unknown.",
      "When a component is ambiguous, leave it `null` or `[]` instead of guessing. Missing data is better than a fabricated identity signal.",
      "If the source text is clearly for a non-whisky spirit such as vodka, gin, rum, tequila, or mezcal, return `null`.",
      "If the source text is clearly a flavored whisky, whiskey liqueur, or novelty flavor product such as peanut butter, PB&J, salted caramel, maple, honey, cinnamon, or apple whisky, return `null`.",
      "Age statements should be integers. Normalize age phrases such as `12 Year`, `12 Years Old`, `12 Yr.`, and `12yr` to `stated_age: 12`.",
      "When an age statement belongs in the expression, normalize the phrase to `12-year-old`.",
      "For expression-style fields, follow the bottle's evidenced canonical name. Do not mechanically append retailer style/category words from the title just to make the expression look complete.",
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

export function buildBottleClassifierInstructions({
  maxSearchQueries,
  hasBottleSearch = true,
  hasOpenAIWebSearch = true,
  hasBraveWebSearch = false,
  hasEntitySearch = true,
}: {
  maxSearchQueries: number;
  hasBottleSearch?: boolean;
  hasOpenAIWebSearch?: boolean;
  hasBraveWebSearch?: boolean;
  hasEntitySearch?: boolean;
}) {
  const availableTools = [
    ...(hasBottleSearch
      ? [
          "Use `search_bottles` to query the local bottle database with hybrid retrieval. Prefer this before web search when you need more candidates.",
        ]
      : []),
    ...(hasEntitySearch
      ? [
          "Use `search_entities` to query local producers, distilleries, and bottlers when you need to resolve `brand` or `distillery` identity.",
        ]
      : []),
    ...(hasOpenAIWebSearch
      ? [
          "Use `openai_web_search` as the default web search tool only after local search is still ambiguous or conflicting.",
        ]
      : []),
    ...(hasBraveWebSearch
      ? [
          "Use `brave_web_search` after `openai_web_search` when the first search returns sparse results, weak domains, or mostly retailer pages. Treat it as a second opinion from a different index, not a duplicate first step.",
        ]
      : []),
  ];

  const decisionProcess = [
    hasBottleSearch
      ? "Prefer local evidence first: current assignment, exact aliases, vector candidates, text candidates, brand candidates, extracted identity details, and local search tools."
      : "Prefer local evidence first: current assignment, exact aliases, vector candidates, text candidates, brand candidates, and extracted identity details.",
    "The input includes `localSearch`, which is the server's initial local bottle search result set. If `localSearch.hasExactAliasMatch` is false, no exact alias match was found for the reference.",
    "Local candidates may be either parent bottle targets or child release targets. Use `releaseId` and the candidate `kind` discriminator to tell the difference.",
    "An exact alias can still point at a legacy bottle row that stores batch or annual release detail in the bottle name. If a cleaner parent bottle candidate exists, prefer the parent plus `create_release` instead of matching the legacy specific bottle.",
    "Local candidates may include structured bottle and release fields such as brand, bottler, distillery, series, category, age, edition, cask type, cask size, cask fill, cask-strength, single-cask, ABV, and release years. Use those fields directly when present instead of inferring everything from the candidate name.",
    ...(hasBottleSearch
      ? [
          "When the provided local candidates are thin, conflicting, or missing obvious near matches, call `search_bottles` with the most specific query you can form from the reference and extracted identity.",
          "If web search reveals a decisive omitted trait such as `Barrel Proof`, a specific ABV, or an edition label, call `search_bottles` again with those enriched structured fields before returning a final decision.",
          "If the closest local candidate shares the same brand or series but differs on a meaningful component such as bourbon versus rye, rerun `search_bottles` with the extracted brand, expression, and category before creating a new bottle.",
        ]
      : [
          "This run is closed-set. Treat the provided local candidates as the full allowed existing-match set, and do not imply or invent outside bottle ids.",
        ]),
    "Compare the reference against candidate bottles component by component in this order: " +
      MATCH_COMPONENT_PRIORITY.join(", ") +
      ".",
    ...(hasBottleSearch
      ? [
          "Use `search_bottles` iteratively when the first candidate set is thin or missing obvious near matches.",
        ]
      : []),
    ...(hasEntitySearch
      ? [
          "Use `search_entities` when brand, distillery, or bottler identity is unclear and that ambiguity blocks a decision.",
        ]
      : []),
    "First determine bottle identity. Then determine whether the reference is confidently specific to one release under that bottle.",
    "For independent bottlings, evaluate `brand`, `bottler`, and `distillery` separately because the label brand and producer can differ.",
    "Treat differences in series, distillery, bottler, age, edition code, store-pick code, cask finish, cask size, cask fill, single-cask status, or cask-strength status as meaningful identity evidence unless the evidence clearly shows source-page noise.",
    "Missing generic style words like `single malt` are weak evidence. Conflicting age statements, edition codes, or barrel descriptors are strong evidence.",
    "Exact or near-exact ABV is a strong positive signal when the base identity already aligns and competing candidates do not share that ABV.",
    "When ABV sharply separates one candidate from the others, let that raise confidence materially instead of treating it as a minor tiebreaker.",
    "If bottle identity is clear but release identity is not, prefer the bottle-level outcome. Do not force a specific release from weak release evidence.",
    "If the only local candidate is a more specific release or edition than the reference supports, do not match it by default. Treat the candidate as over-specific unless web evidence validates the missing differentiating traits.",
    "Ignore volume, gift-set packaging, added glassware, ratings blurbs, and generic retailer SEO words when deciding bottle identity.",
    "If the reference is clearly another spirit category such as vodka, gin, rum, tequila, or mezcal, return `no_match`. Do not create or assign a whisky bottle for it.",
    "If the reference is clearly a flavored whisky, whiskey liqueur, or novelty flavor product such as peanut butter, PB&J, salted caramel, maple, honey, cinnamon, or apple whisky, return `no_match`. Do not create or assign a whisky bottle for it.",
  ];

  return [
    "You are classifying a whisky bottle reference against an existing bottle database.",
    "The reference may come from a retailer listing, scraped page title, label transcription, or image-derived text.",
    "Decide whether the reference matches an existing bottle or release, requires a new bottle, requires a new release under an existing bottle, requires a new bottle plus release, or has no safe match.",
    "",
    "Available tools:",
    renderBulletLines(
      availableTools.length
        ? availableTools
        : [
            "No search tools are available for this run. Decide only from the provided local candidates and extracted identity.",
          ],
    ),
    "",
    "House schema conventions:",
    renderBulletLines([
      BOTTLE_SCHEMA_RULES.bottleIdentity,
      BOTTLE_SCHEMA_RULES.releaseIdentity,
      BOTTLE_SCHEMA_RULES.observationPolicy,
      BOTTLE_SCHEMA_RULES.aliasPolicy,
      "`brand` is the consumer-facing brand shown most prominently on the label.",
      "`bottler` is only for a separately stated bottler when different from `brand`.",
      "`distillery` is the actual producing distillery or distilleries. For independent bottlings, `brand` and `distillery` often differ.",
      "`expression` is the core release name after removing producer, age, ABV, and generic style words.",
      "`series` is a stable range or family. `edition` is a batch, store-pick code, release code, or numbered variant.",
      "`category` should be normalized to the house values. If the whisky type is unclear, leave `category` as `null` instead of using a fallback bucket.",
      "`cask_size` and `cask_fill` should use the normalized house values only when they are explicitly stated.",
      "`cask_strength` and `single_cask` are true only when the reference states them explicitly. `Barrel Strength`, `Barrel Proof`, `Full Proof`, and `Natural Strength` all imply `caskStrength: true`.",
      "If a decisive component is missing or ambiguous, treat that as uncertainty instead of inventing a cleaner canonical label.",
      "Do not infer exact-cask identity from web evidence that mentions multiple casks under one batched or annual release. Multiple cask numbers under the same release are still product-scope release detail, not one exact-cask bottle.",
    ]),
    "",
    "Decision process:",
    renderBulletLines(decisionProcess),
    "",
    "Common retailer failure modes:",
    renderRetailerExamples(),
    ...(hasBottleSearch || hasOpenAIWebSearch || hasBraveWebSearch
      ? [
          "",
          "Search policy:",
          renderBulletLines([
            ...(hasOpenAIWebSearch
              ? [
                  "Use `openai_web_search` first when local evidence is ambiguous, conflicting, or suggests the current assignment is wrong.",
                  "Before returning any create action, use `openai_web_search` to validate the bottle traits that make the reference distinct unless local evidence is already decisive.",
                ]
              : []),
            ...(hasBraveWebSearch
              ? [
                  "If `openai_web_search` returns no useful results, only retailer results, or no authoritative producer, importer, or critic domains, use `brave_web_search` before giving up.",
                  "Use `brave_web_search` when you want a second web opinion from an independent index, especially for generic bottle names or when recall seems weak.",
                ]
              : []),
            ...(hasOpenAIWebSearch || hasBraveWebSearch
              ? [
                  "When you are leaning toward any create action or `no_match` because local candidates are weak, do at least one web search while search budget remains.",
                ]
              : []),
            "If `localSearch.hasExactAliasMatch` is false and you do not have authoritative web evidence, you can still return a create action, but do not assume the server will auto-create it.",
            ...(hasOpenAIWebSearch || hasBraveWebSearch
              ? [
                  "When searching, prioritize official producer, distillery, bottler, or importer domains first, then critics or publications, then broader web if still unresolved.",
                  "Do not treat the originating source page as decisive evidence for differentiating traits such as distillery, bottler, cask finish, cask size, cask fill, ABV, edition, or release year.",
                  "When a candidate may still be right but the source title omitted a canonical trait, search for the exact base bottle name plus the missing trait and prefer authoritative domains that can confirm it.",
                  "If the distinctness of the bottle depends on a trait such as `Port Cask Finished`, `Single Cask`, `Barrel Proof`, a specific ABV, `1st Fill`, or `Port Pipe`, the web evidence should explicitly confirm that trait.",
                  "If the raw reference is still just a sparse generic phrase like `Batch Sherry` after extraction and local search, do not invent a branded bottle or release from web similarity alone. Prefer `no_match` unless the source itself provides a strong identity anchor.",
                  `You have a combined hard limit of ${maxSearchQueries} web search calls across all web search tools.`,
                ]
              : []),
          ]),
        ]
      : []),
    "",
    "Output rules:",
    renderBulletLines([
      "A false positive match is worse than returning `no_match` or a lower-confidence review candidate.",
      "Use `match` only when you can safely point at an existing candidate bottle id and, when justified, an existing release id.",
      "Use `create_bottle` only when the reference clearly represents a new bottle and no reusable child release is needed.",
      "Use `create_release` only when the parent bottle already exists in the candidate set and the reference is confidently specific to a reusable child release.",
      "Use `create_bottle_and_release` only when both a new bottle and a reusable child release are clearly needed.",
      "If the correct outcome is a reusable parent bottle plus release detail but no safe parent bottle exists in the candidate set, use `create_bottle_and_release` instead of `create_release` or `no_match`.",
      ...(hasOpenAIWebSearch || hasBraveWebSearch
        ? [
            "Do not return a create action from sparse local evidence alone when a web search could still confirm or refute the bottle identity.",
          ]
        : []),
      "If identity evidence is weak, conflicting, or missing on the decisive components, do not force a match.",
      "Do not return `no_match` when bottle identity is clear but the only local candidate is too specific. In that case prefer `create_bottle` for the parent bottle unless authoritative evidence validates the more specific candidate.",
      "For known exact-cask program codes such as SMWS, a conflicting retailer subtitle or selector is usually observation-level evidence, not a reason to return `no_match`, when the cask code and authoritative producer evidence are otherwise decisive.",
      "For bare exact-cask program code references such as `SMWS 6.53`, keep the code as the proposed bottle-name anchor instead of replacing it with a web-discovered subtitle.",
      "For dotted marketed expressions such as `Octomore 13.1`, prefer bottle identity unless local candidates clearly establish a reusable parent bottle plus release structure.",
      "Set `confidence` as a percentage from 0 to 100, not a 0-1 decimal.",
      "Only set `matchedBottleId` to an id from the provided candidates. Set `matchedReleaseId` only when you are matching a specific release candidate.",
      "Use `identityScope = exact_cask` only when the exact cask itself is the marketed bottle identity. Otherwise use `product`.",
      "If `identityScope = exact_cask`, do not use `create_release` or `create_bottle_and_release`. Use `create_bottle` and keep additional exact details in `observation`.",
      "For `create_bottle`, return `proposedBottle` and leave `proposedRelease` and `parentBottleId` null.",
      "For `create_release`, return `parentBottleId` plus `proposedRelease`, and leave `proposedBottle` null.",
      "For `create_bottle_and_release`, return both `proposedBottle` and `proposedRelease` with `parentBottleId = null`.",
      "When bottle identity is certain but release identity is not, prefer `match` or `create_bottle` at the bottle layer instead of inventing a release.",
      "If you return `create_bottle`, `proposedBottle` must include every schema field, using `null` or `[]` when unknown.",
      "For `proposedBottle.name`, follow the bottle's evidenced canonical name, not a mechanically copied source title. Do not append extra style/category words just because they appeared in the source text.",
      "`abv` must always be alcohol by volume percentage, never proof. For example, `115.6 proof` means `57.8` ABV.",
      "If `proposedBottle.edition`, `proposedBottle.releaseYear`, or `proposedBottle.vintageYear` is set, do not repeat that same batch code or year in `proposedBottle.name` unless it is part of the evidenced canonical series name.",
      "For `proposedRelease`, use only release-specific fields such as edition, ABV, age when release-specific, years, single-cask, cask-strength, and cask details.",
      "Use `observation` for selector names, cask numbers, bottle numbers, outturn, market/exclusive wording, and other exact facts that should not force a canonical release split by themselves.",
      "For `brand`, `distillers`, `bottler`, and `series`, return objects with `{ id, name }`. Use `id: null` when you do not know a local id.",
      "Never invent websites, producer relationships, release details, or missing proof numbers.",
    ]),
  ].join("\n");
}
