import { BOTTLE_SCHEMA_RULES } from "./bottleSchemaGuidance";
import type { BottleExtractedDetails } from "./classifierTypes";

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
  output: Partial<BottleExtractedDetails> | null;
};

const CATEGORY_VALUES = [
  "`blend`",
  "`blended_grain`",
  "`blended_malt`",
  "`bourbon`",
  "`corn`",
  "`rye`",
  "`single_grain`",
  "`single_malt`",
  "`single_pot_still`",
  "`wheat`",
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
      "For independent bottlings, use the bottler label as `brand` only when that label is also the consumer-facing Brand. Keep a distinct consumer-facing label as `brand`, put the independent bottler in `bottler`, and put the actual producer in `distillery`.",
    ],
  },
  {
    id: "bottler",
    label: "Bottler",
    outputField: "`bottler`",
    guidance: [
      "Set `bottler` only for a business that independently selects and releases whisky made by another producer.",
      "An official Brand or distillery release has no bottler.",
      "The bottler may also be `brand`. Ownership, importing, distribution, or physical packing alone does not prove the role.",
      "Leave this null when product-specific evidence does not establish this Bottle relationship.",
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
      "This is the name people use for the bottle after the brand, as the producer's title and the label print it. Drop generic style words, ABV, and package size.",
      "Keep a release number or title that people say as the bottle's name, such as a numbered release, a volume, a chapter, or an act and scene. Keep it whole; do not split a release number into a range and a number.",
      "If the title is only producer plus age plus generic style words, `expression` can be `null`.",
    ],
  },
  {
    id: "series",
    label: "Series / range",
    outputField: "`series`",
    guidance: [
      "Use this only for a named range the producer markets above several different releases.",
      "A number that counts the producer's yearly or numbered releases is not a series; it stays in the release name. Batch codes and release years are not a series either.",
    ],
  },
  {
    id: "edition",
    label: "Edition / batch / release code",
    outputField: "`edition`",
    guidance: [
      "Use this for a release fact that is not part of the name people use: a batch label, a store pick or selection printed on the label, a market, or a release code, such as `Batch 3`, `for The Whisky Exchange`, or `S2B13`.",
      "Copy the exact marketed wording from the producer's product title or visible label. Narrative prose can confirm that a code identifies a release, but it cannot add `Release`, `Edition`, `Batch`, `Volume`, or another descriptor that the title and label omit.",
      "Treat short suffix codes as meaningful identity signals when they look like a batch or store-pick marker.",
      "Put a cask or barrel identifier in `cask_number`, never in `edition`.",
      "Re-read handwritten or visually ambiguous cask, barrel, batch, and edition digits before returning them. If the exact characters remain uncertain, leave `edition` null instead of guessing.",
      "If `edition` captures a batch, store-pick, or release label, do not repeat that same text inside `expression` or `proposedBottle.name`.",
    ],
  },
  {
    id: "category",
    label: "Category / style",
    outputField: "`category`",
    guidance: [
      `Normalize into one of ${CATEGORY_VALUES}.`,
      "Use the most specific recognized whisky style. Treat the country and region as separate facts. Follow the local legal style when the source states one.",
      "Use `blend` for a general blended-whisky designation. Use `blended_malt` for single malts from more than one distillery. Use `blended_grain` for grain whiskies from more than one distillery.",
      "A specific grain style takes precedence over blend construction. Classify blended rye as `rye`, blended corn whisky as `corn`, and blended wheat whisky as `wheat`. Classify bourbon as `bourbon`, not `corn`.",
      "Use `corn`, `rye`, or `wheat` when the source states that recognized style. Do not infer a majority grain from tasting notes, location, or an unstated mash bill.",
      "Only return `single_malt` when the source explicitly says single malt. Do not collapse `malt whiskey` or `straight malt whiskey` into `single_malt`; leave `category` as `null` if no house value fits.",
      "If the whisky category is unclear, return `null`. Do not use `spirit`, `grain`, `malt`, `whisky`, or a regional name as a fallback category.",
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
    outputField:
      "`abv`, `vintage_year`, `bottling_year`, `release_year`, `release_month`, `release_day`",
    guidance: [
      "ABV is the numeric alcohol percentage.",
      "If the source gives proof instead of ABV, convert proof to ABV by dividing by 2. Never copy a proof number directly into `abv`.",
      "Use `vintage_year` only for the distillation year.",
      "Use `bottling_year` only when the source identifies the year the whisky was bottled.",
      "Use `release_year` for the year the marketed release became available.",
      "Set `release_month` and `release_day` only with `release_year`, when the source gives the release date. Never fill them from a bottling or fill date.",
      "Leave all three year fields null when the source gives a year without showing what it means.",
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
      bottler: "Gordon & MacPhail",
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
    BOTTLE_SCHEMA_RULES.referencePolicy,
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
          "Transcribe all readable bottle and label text verbatim into `rawLabelText`. Preserve exact cask, barrel, batch, bottle, vintage, and date markers without normalizing or silently dropping them.",
          "Before returning `abv`, verify every digit against visible `%`, `ABV`, `alc/vol`, or proof text. Re-read small digits that can resemble another digit, such as 0 and 6.",
          "If any ABV digit or decimal remains unclear at the available image resolution, return `abv: null`. Never substitute a common bottling strength.",
          "Do not infer missing text from bottle shape, brand colors, or background page elements.",
        ]
      : [
          "Treat the input as source title text that may be retailer-derived, abbreviated, reordered, or incomplete.",
          "Do not assume the source title is canonical just because it is grammatically clean.",
        ];

  return [
    "You extract structured whisky bottle identity from label text and source titles.",
    "Return the best normalized Bottle for the input. If the input is not a whisky Bottle Reference, return null.",
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
      "Set `bottler` only for a business that independently selects and releases whisky made by another producer.",
      "An official Brand or distillery release has no bottler.",
      "The bottler may also be `brand`. Ownership, importing, distribution, or physical packing alone does not prove the role.",
      "When the visible label, capsule, or neck tag explicitly names a producer with `Distillery` in the name, include that producer in `distillery` even if the front brand is a shorter consumer label.",
      "Prefer `[]` over guessing when the producing distillery is unknown.",
      "When a component is ambiguous, leave it `null` or `[]` instead of guessing. Missing data is better than a fabricated identity signal.",
      "For exact-cask labels, put the cask or barrel code in `cask_number` and keep a prominent marketed cask title in `expression`; keep tasting-note prose out of `expression`.",
      "A `Bottle No.` value identifies one physical bottle and is observation-only; never use it as `edition` or substitute it for a separately evidenced `Cask No.` or `Barrel No.` marketed identity.",
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
      "Set `vintage_year`, `bottling_year`, or `release_year` only when the source makes the meaning clear. Leave a year unset when its meaning is unclear.",
      "If `edition`, `release_year`, `bottling_year`, or `vintage_year` is set, do not also copy that same batch code or year into `expression`.",
      "Use `release_year` only for the year the release became available, not a bottling year, founding date, or warning text.",
      "If both distillation and bottling years are present, use `vintage_year` for the distillation year and `bottling_year` for the bottling year.",
      "If the source gives proof instead of ABV, convert proof to ABV by dividing by 2 and store only the ABV percentage.",
      "Put the producer-stated casks into `maturation` as one short phrase in order of use, at most 120 characters: keep the producer's fill, wood, previous-contents, and size words; drop story wording, cask counts, dates, and percentages. Example: `Ex-sherry European oak, finished in PX-seasoned new American oak hogsheads`. Use `cask_number` for a marketed cask or barrel identifier and `outturn` for the stated total bottle count. Do not infer missing values.",
      "Set `cask_strength` and `single_cask` only when the label states them explicitly. `Barrel Strength`, `Barrel Proof`, `Full Proof`, and `Natural Strength` all count as `cask_strength: true`.",
      "A specific `Cask No.` or `Barrel No.` on a single-bottle whisky label counts as `single_cask: true` when the label presents it as the source barrel/cask identity.",
      "Copy that cask or barrel identifier into `cask_number` without the `Cask No.` or `Barrel No.` words, for example `4769`.",
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
      "Return the normalized bottle fields inside `result`.",
      mode === "image"
        ? "Return the complete readable label transcription in `rawLabelText`, or null when no label text is readable."
        : "Return `rawLabelText: null` for text input.",
      "Use `null` for missing scalar values.",
      "Use an array for `distillery`; prefer `[]` when the distillery is unknown.",
      "The object fields are `brand`, `bottler`, `expression`, `series`, `distillery`, `category`, `stated_age`, `abv`, `vintage_year`, `bottling_year`, `release_year`, `release_month`, `release_day`, `cask_strength`, `single_cask`, `maturation`, `cask_number`, `outturn`, and `edition`.",
    ]),
    "",
    "Examples:",
    renderExtractionExamples(),
  ].join("\n");
}
