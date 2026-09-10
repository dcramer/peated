import { CURRENCY_LIST } from "@peated/server/constants";
import { z } from "zod";
import {
  ScrapeTextMatchesSchema,
  ScrapeTextTemplateSchema,
} from "./textTemplate";

export const SCRAPE_RULES_VERSION = 11;
// TODO(scraper-platform): Add event after scraped-event match and update rules are defined.
export const SCRAPE_SOURCE_KIND_LIST = ["review", "price", "catalog"] as const;
export type ScrapeSourceKind = (typeof SCRAPE_SOURCE_KIND_LIST)[number];
export const SCRAPE_SOURCE_MAX_LIST_PAGES = 5;
const SCRAPE_SOURCE_DEFAULT_MAX_ITEMS = 25;
export const SCRAPE_SOURCE_MAX_ITEMS = 99;

const SCRAPE_VALUE_MAX_LENGTH = 200;
const SCRAPE_LITERAL_MAX_LENGTH = 100;
const SCRAPE_LITERAL_MAX_ITEMS = 10;
const SCRAPE_SCORE_MAP_MAX_ITEMS = 25;

export const ScrapeSelectorSchema = z.string().trim().min(1).max(500);

const ScrapeAttributeSchema = z.string().trim().min(1).max(100);

const ScrapeLiteralSchema = z
  .string()
  .trim()
  .min(1)
  .max(SCRAPE_LITERAL_MAX_LENGTH);
const ScrapeLiteralListSchema = z
  .array(ScrapeLiteralSchema)
  .min(1)
  .max(SCRAPE_LITERAL_MAX_ITEMS);
const ScrapeCleanupSchema = {
  removePrefixes: ScrapeLiteralListSchema.optional(),
  removeSuffixes: ScrapeLiteralListSchema.optional(),
  prefix: z.string().min(1).max(SCRAPE_VALUE_MAX_LENGTH).optional(),
  suffix: z.string().min(1).max(SCRAPE_VALUE_MAX_LENGTH).optional(),
};

const ScrapeValueSelectorV1Schema = z
  .object({
    selector: ScrapeSelectorSchema,
    attribute: ScrapeAttributeSchema.optional(),
  })
  .strict();

const ScrapeTextValueSelectorSchema = z
  .object({
    selector: ScrapeSelectorSchema,
    startsWith: ScrapeLiteralListSchema.optional(),
    all: z.literal(true).optional(),
    ...ScrapeCleanupSchema,
  })
  .strict();

const ScrapeAttributeValueSelectorSchema = z
  .object({
    selector: ScrapeSelectorSchema,
    attribute: ScrapeAttributeSchema,
    ...ScrapeCleanupSchema,
  })
  .strict();

const ScrapeFixedValueSchema = z
  .object({
    value: z.string().trim().min(1).max(SCRAPE_VALUE_MAX_LENGTH),
    ...ScrapeCleanupSchema,
  })
  .strict();

export const ScrapeValueSchema = z.union([
  ScrapeTextValueSelectorSchema,
  ScrapeAttributeValueSelectorSchema,
  ScrapeFixedValueSchema,
]);

const ListRulesV1Schema = z
  .object({
    detailLink: ScrapeValueSelectorV1Schema,
    nextPage: ScrapeValueSelectorV1Schema.optional(),
    maxItems: z
      .number()
      .int()
      .min(1)
      .max(SCRAPE_SOURCE_MAX_ITEMS)
      .default(SCRAPE_SOURCE_DEFAULT_MAX_ITEMS),
  })
  .strict();

const ScrapeListExclusionSchema = z
  .object({
    selector: ScrapeSelectorSchema,
    startsWith: ScrapeLiteralListSchema.optional(),
  })
  .strict();

const ListRulesSchema = ListRulesV1Schema.extend({
  item: ScrapeSelectorSchema.optional(),
  excludeWhen: ScrapeListExclusionSchema.optional(),
})
  .strict()
  .superRefine((rules, context) => {
    if (rules.excludeWhen && !rules.item) {
      context.addIssue({
        code: "custom",
        path: ["excludeWhen"],
        message: "List exclusion requires an item selector.",
      });
    }
  });

function reviewRulesSchema<T extends z.ZodType, U extends z.ZodType>(
  valueSchema: T,
  listSchema: U,
) {
  return z
    .object({
      kind: z.literal("review"),
      list: listSchema,
      detail: z
        .object({
          title: valueSchema,
          publishedAt: valueSchema.optional(),
          reviewItem: ScrapeSelectorSchema,
          name: valueSchema,
          reviewerName: valueSchema.optional(),
          reviewText: valueSchema.optional(),
          score: z
            .object({
              value: valueSchema,
              scale: z.number().positive(),
            })
            .strict()
            .optional(),
        })
        .strict(),
    })
    .strict();
}

const ScrapeUrlDateFormatSchema = z
  .string()
  .trim()
  .min(1)
  .max(SCRAPE_VALUE_MAX_LENGTH)
  .superRefine((format, context) => {
    const tokens: string[] = format.match(/yyyy|yy|MM|dd|\*/g) ?? [];
    const literal = format.replaceAll(/yyyy|yy|MM|dd|\*/g, "");
    if (!tokens.includes("yyyy") && !tokens.includes("yy")) {
      context.addIssue({
        code: "custom",
        message: "URL date format requires yyyy or yy.",
      });
    }
    if (!tokens.includes("MM") || !tokens.includes("dd")) {
      context.addIssue({
        code: "custom",
        message: "URL date format requires MM and dd.",
      });
    }
    if (/[A-Za-z0-9]/.test(literal)) {
      context.addIssue({
        code: "custom",
        message: "URL date format contains an unsupported token.",
      });
    }
  });

const ScrapeUrlDateSchema = z
  .object({
    urlDateFormat: ScrapeUrlDateFormatSchema,
  })
  .strict();

const ScrapeScoreMapEntrySchema = z
  .object({
    text: ScrapeLiteralSchema,
    value: z.number().nonnegative(),
  })
  .strict();

function validateScoreMap(
  score: {
    scale: number;
    map?: Array<z.infer<typeof ScrapeScoreMapEntrySchema>> | null;
  },
  context: z.RefinementCtx,
) {
  const labels = new Set<string>();
  for (const [index, entry] of (score.map ?? []).entries()) {
    if (entry.value > score.scale) {
      context.addIssue({
        code: "custom",
        path: ["map", index, "value"],
        message: "Mapped score cannot exceed its scale.",
      });
    }
    const label = entry.text.toLocaleLowerCase("en");
    if (labels.has(label)) {
      context.addIssue({
        code: "custom",
        path: ["map", index, "text"],
        message: "Mapped score labels must be unique.",
      });
    }
    labels.add(label);
  }
}

const ScrapeScoreSchema = z
  .object({
    value: ScrapeValueSchema,
    scale: z.number().positive(),
    map: z
      .array(ScrapeScoreMapEntrySchema)
      .min(1)
      .max(SCRAPE_SCORE_MAP_MAX_ITEMS)
      .optional(),
  })
  .strict()
  .superRefine(validateScoreMap);

function legacyReviewRulesSchema<T extends z.ZodType, U extends z.ZodType>(
  reviewItemSchema: T,
  scoreSchema: U,
) {
  return z
    .object({
      kind: z.literal("review"),
      list: ListRulesSchema,
      detail: z
        .object({
          canonicalUrl: ScrapeValueSchema.optional(),
          title: ScrapeValueSchema,
          publishedAt: z
            .union([ScrapeValueSchema, ScrapeUrlDateSchema])
            .optional(),
          reviewItem: reviewItemSchema,
          name: ScrapeValueSchema,
          reviewerName: ScrapeValueSchema.optional(),
          reviewText: ScrapeValueSchema.optional(),
          score: scoreSchema.optional(),
        })
        .strict(),
    })
    .strict();
}

function priceRulesSchema<T extends z.ZodType, U extends z.ZodType>(
  valueSchema: T,
  listSchema: U,
) {
  return z
    .object({
      kind: z.literal("price"),
      list: listSchema,
      detail: z
        .object({
          name: valueSchema,
          price: valueSchema,
          currency: z.enum(CURRENCY_LIST),
          volume: valueSchema,
          url: valueSchema.optional(),
          externalProductId: valueSchema.optional(),
          imageUrl: valueSchema.optional(),
          barcode: valueSchema.optional(),
        })
        .strict(),
    })
    .strict();
}

export const ScrapeRulesV1Schema = z.discriminatedUnion("kind", [
  reviewRulesSchema(ScrapeValueSelectorV1Schema, ListRulesV1Schema),
  priceRulesSchema(ScrapeValueSelectorV1Schema, ListRulesV1Schema),
]);

export const ScrapeRulesV3Schema = z.discriminatedUnion("kind", [
  legacyReviewRulesSchema(ScrapeSelectorSchema, ScrapeScoreSchema),
  priceRulesSchema(ScrapeValueSchema, ListRulesSchema),
]);

const ScrapeCleanupV6Schema = z
  .object({
    removeStart: ScrapeLiteralListSchema.nullable(),
    removeEnd: ScrapeLiteralListSchema.nullable(),
    addStart: z.string().min(1).max(SCRAPE_VALUE_MAX_LENGTH).nullable(),
    addEnd: z.string().min(1).max(SCRAPE_VALUE_MAX_LENGTH).nullable(),
  })
  .strict();

const ScrapeTextReadV6Schema = z
  .object({
    get: z.literal("text"),
    selector: ScrapeSelectorSchema,
    take: z.enum(["first", "all"]),
    startsWith: ScrapeLiteralListSchema.nullable(),
    clean: ScrapeCleanupV6Schema.nullable(),
  })
  .strict();

const ScrapeAttributeReadV6Schema = z
  .object({
    get: z.literal("attribute"),
    selector: ScrapeSelectorSchema,
    attribute: ScrapeAttributeSchema,
    clean: ScrapeCleanupV6Schema.nullable(),
  })
  .strict();

const ScrapeFixedReadV6Schema = z
  .object({
    get: z.literal("fixed"),
    value: z.string().trim().min(1).max(SCRAPE_VALUE_MAX_LENGTH),
    clean: ScrapeCleanupV6Schema.nullable(),
  })
  .strict();

const ScrapeDateFromUrlV6Schema = z
  .object({
    get: z.literal("dateFromUrl"),
    format: ScrapeUrlDateFormatSchema,
  })
  .strict();

const ScrapePageReadV6Schema = z.union([
  ScrapeTextReadV6Schema,
  ScrapeAttributeReadV6Schema,
  ScrapeFixedReadV6Schema,
]);

const ReviewUseSchema = z.enum(["firstReview", "everyReview"]);
const ScrapeReviewReadV6Schema = z.union([
  ScrapeTextReadV6Schema.extend({ from: z.literal("review") }).strict(),
  ScrapeAttributeReadV6Schema.extend({ from: z.literal("review") }).strict(),
  ScrapeTextReadV6Schema.extend({
    from: z.literal("article"),
    useFor: ReviewUseSchema,
  }).strict(),
  ScrapeAttributeReadV6Schema.extend({
    from: z.literal("article"),
    useFor: ReviewUseSchema,
  }).strict(),
  ScrapeFixedReadV6Schema,
]);
const ScrapeReviewTryV6Schema = z.array(ScrapeReviewReadV6Schema).min(1).max(3);

const ScrapePageFieldV6Schema = z
  .object({
    try: z.array(ScrapePageReadV6Schema).min(1).max(3),
  })
  .strict();

const ScrapeReviewFieldV6Schema = z
  .object({
    try: ScrapeReviewTryV6Schema,
  })
  .strict();

const ScrapeDateFieldV6Schema = z
  .object({
    try: z
      .array(z.union([ScrapePageReadV6Schema, ScrapeDateFromUrlV6Schema]))
      .min(1)
      .max(3),
  })
  .strict();

const ScrapeSkipV6Schema = z
  .object({
    selector: ScrapeSelectorSchema,
    startsWith: ScrapeLiteralListSchema.nullable(),
  })
  .strict();

function scrapeScoreSchema<T extends z.ZodType>(trySchema: T) {
  return z
    .object({
      try: trySchema,
      scale: z.number().positive(),
      map: z
        .array(ScrapeScoreMapEntrySchema)
        .min(1)
        .max(SCRAPE_SCORE_MAP_MAX_ITEMS)
        .nullable(),
    })
    .strict()
    .superRefine(validateScoreMap);
}

const ScrapeScoreV6Schema = scrapeScoreSchema(ScrapeReviewTryV6Schema);

const scrapeReviewFieldsV6 = {
  name: ScrapeReviewFieldV6Schema,
  reviewer: ScrapeReviewFieldV6Schema.nullable(),
  tastingNotes: ScrapeReviewFieldV6Schema.nullable(),
  score: ScrapeScoreV6Schema.nullable(),
};

const ScrapeReviewGroupsV6Schema = z.union([
  z
    .object({
      inside: ScrapeSelectorSchema,
      oneReviewPer: z.literal("element"),
      selector: ScrapeSelectorSchema,
      ...scrapeReviewFieldsV6,
    })
    .strict(),
  z
    .object({
      inside: ScrapeSelectorSchema,
      oneReviewPer: z.literal("heading"),
      selector: ScrapeSelectorSchema,
      stopBefore: ScrapeSelectorSchema.nullable(),
      whenOnlyOneReview: z.enum(["startAtHeading", "useWholeArea"]),
      ...scrapeReviewFieldsV6,
    })
    .strict(),
]);

const ScrapeArticlesV6Schema = z
  .object({
    oneArticlePer: ScrapeSelectorSchema,
    link: ScrapeSelectorSchema,
    skipWhen: ScrapeSkipV6Schema.nullable(),
    nextPage: ScrapeSelectorSchema.nullable(),
    limit: z.number().int().min(1).max(SCRAPE_SOURCE_MAX_ITEMS),
  })
  .strict();

const ScrapeProductsV6Schema = z
  .object({
    oneProductPer: ScrapeSelectorSchema,
    link: ScrapeSelectorSchema,
    skipWhen: ScrapeSkipV6Schema.nullable(),
    nextPage: ScrapeSelectorSchema.nullable(),
    limit: z.number().int().min(1).max(SCRAPE_SOURCE_MAX_ITEMS),
  })
  .strict();

const ScrapeReviewRulesV6Schema = z
  .object({
    kind: z.literal("review"),
    articles: ScrapeArticlesV6Schema,
    article: z
      .object({
        canonicalUrl: ScrapePageFieldV6Schema.nullable(),
        title: ScrapePageFieldV6Schema,
        publishedDate: ScrapeDateFieldV6Schema,
        reviews: ScrapeReviewGroupsV6Schema,
      })
      .strict(),
  })
  .strict();

const ScrapePriceRulesV6Schema = z
  .object({
    kind: z.literal("price"),
    products: ScrapeProductsV6Schema,
    product: z
      .object({
        name: ScrapePageFieldV6Schema,
        price: ScrapePageFieldV6Schema,
        currency: z.enum(CURRENCY_LIST),
        volume: ScrapePageFieldV6Schema,
        url: ScrapePageFieldV6Schema.nullable(),
        externalProductId: ScrapePageFieldV6Schema.nullable(),
        imageUrl: ScrapePageFieldV6Schema.nullable(),
        barcode: ScrapePageFieldV6Schema.nullable(),
      })
      .strict(),
  })
  .strict();

export const ScrapeRulesV6Schema = z.discriminatedUnion("kind", [
  ScrapeReviewRulesV6Schema,
  ScrapePriceRulesV6Schema,
]);

const ScrapeCatalogRulesV7Schema = z
  .object({
    kind: z.literal("catalog"),
    products: ScrapeProductsV6Schema,
    product: z
      .object({
        name: ScrapePageFieldV6Schema,
        url: ScrapePageFieldV6Schema.nullable(),
        externalProductId: ScrapePageFieldV6Schema.nullable(),
        imageUrl: ScrapePageFieldV6Schema.nullable(),
        volume: ScrapePageFieldV6Schema.nullable(),
        abv: ScrapePageFieldV6Schema.nullable(),
        statedAge: ScrapePageFieldV6Schema.nullable(),
        edition: ScrapePageFieldV6Schema.nullable(),
        releaseYear: ScrapePageFieldV6Schema.nullable(),
      })
      .strict(),
  })
  .strict();

export const ScrapeRulesV7Schema = z.discriminatedUnion("kind", [
  ScrapeReviewRulesV6Schema,
  ScrapePriceRulesV6Schema,
  ScrapeCatalogRulesV7Schema,
]);

const scrapeReadResultV8 = {
  match: ScrapeTextMatchesSchema.nullable(),
  addStart: z.string().min(1).max(SCRAPE_VALUE_MAX_LENGTH).nullable(),
  addEnd: z.string().min(1).max(SCRAPE_VALUE_MAX_LENGTH).nullable(),
};

const ScrapeTextReadV8Schema = z
  .object({
    get: z.literal("text"),
    selector: ScrapeSelectorSchema,
    take: z.enum(["first", "all"]),
    ...scrapeReadResultV8,
  })
  .strict();

const ScrapeAttributeReadV8Schema = z
  .object({
    get: z.literal("attribute"),
    selector: ScrapeSelectorSchema,
    attribute: ScrapeAttributeSchema,
    ...scrapeReadResultV8,
  })
  .strict();

const ScrapeFixedReadV8Schema = z
  .object({
    get: z.literal("fixed"),
    value: z.string().trim().min(1).max(SCRAPE_VALUE_MAX_LENGTH),
    addStart: scrapeReadResultV8.addStart,
    addEnd: scrapeReadResultV8.addEnd,
  })
  .strict();

const ScrapePageReadSchema = z.union([
  ScrapeTextReadV8Schema,
  ScrapeAttributeReadV8Schema,
  ScrapeFixedReadV8Schema,
]);

const ScrapeReviewReadV8Schema = z.union([
  ScrapeTextReadV8Schema.extend({ from: z.literal("review") }).strict(),
  ScrapeAttributeReadV8Schema.extend({ from: z.literal("review") }).strict(),
  ScrapeTextReadV8Schema.extend({
    from: z.literal("article"),
    useFor: ReviewUseSchema,
  }).strict(),
  ScrapeAttributeReadV8Schema.extend({
    from: z.literal("article"),
    useFor: ReviewUseSchema,
  }).strict(),
  ScrapeFixedReadV8Schema,
]);

const ScrapeReviewTryV8Schema = z.array(ScrapeReviewReadV8Schema).min(1).max(3);

const ScrapePageFieldSchema = z
  .object({ try: z.array(ScrapePageReadSchema).min(1).max(3) })
  .strict();

const ScrapeReviewFieldSchema = z
  .object({ try: ScrapeReviewTryV8Schema })
  .strict();

const ScrapeDateFieldV8Schema = z
  .object({
    try: z
      .array(z.union([ScrapePageReadSchema, ScrapeDateFromUrlV6Schema]))
      .min(1)
      .max(3),
  })
  .strict();

const ScrapeDateFromAttributeV9Schema = z
  .object({
    get: z.literal("dateFromAttribute"),
    selector: ScrapeSelectorSchema,
    attribute: ScrapeAttributeSchema,
    format: ScrapeUrlDateFormatSchema,
  })
  .strict();

const ScrapeDateFieldV9Schema = z
  .object({
    try: z
      .array(
        z.union([
          ScrapePageReadSchema,
          ScrapeDateFromUrlV6Schema,
          ScrapeDateFromAttributeV9Schema,
        ]),
      )
      .min(1)
      .max(3),
  })
  .strict();

const ScrapeScoreV8Schema = scrapeScoreSchema(ScrapeReviewTryV8Schema);

const scrapeReviewFieldsV8 = {
  name: ScrapeReviewFieldSchema,
  reviewer: ScrapeReviewFieldSchema.nullable(),
  tastingNotes: ScrapeReviewFieldSchema.nullable(),
  score: ScrapeScoreV8Schema.nullable(),
};

const ScrapeTextMarkerV8Schema = z
  .object({
    selector: ScrapeSelectorSchema,
    match: ScrapeTextMatchesSchema.nullable(),
  })
  .strict();

const ScrapeReviewGroupsV8Schema = z.union([
  z
    .object({
      inside: ScrapeSelectorSchema,
      oneReviewPer: z.literal("element"),
      selector: ScrapeSelectorSchema,
      ...scrapeReviewFieldsV8,
    })
    .strict(),
  z
    .object({
      inside: ScrapeSelectorSchema,
      oneReviewPer: z.literal("section"),
      startsAt: ScrapeTextMarkerV8Schema,
      stopBefore: ScrapeTextMarkerV8Schema.nullable(),
      whenOnlyOneReview: z.enum(["startAtReview", "useWholeArea"]),
      ...scrapeReviewFieldsV8,
    })
    .strict(),
]);

const ScrapeSkipV8Schema = z
  .object({
    selector: ScrapeSelectorSchema,
    match: ScrapeTextMatchesSchema.nullable(),
  })
  .strict();

const ScrapeArticlesV8Schema = ScrapeArticlesV6Schema.extend({
  skipWhen: ScrapeSkipV8Schema.nullable(),
}).strict();

const ScrapeSkipV9Schema = ScrapeSkipV8Schema.extend({
  match: z.array(ScrapeTextTemplateSchema).min(1).max(10).nullable(),
}).strict();

const ScrapeArticlesV9Schema = ScrapeArticlesV8Schema.extend({
  document: z.enum(["html", "xml"]),
  skipWhen: ScrapeSkipV9Schema.nullable(),
}).strict();

const ScrapeProductsV8Schema = ScrapeProductsV6Schema.extend({
  skipWhen: ScrapeSkipV8Schema.nullable(),
}).strict();

const ScrapeReviewRulesV8Schema = z
  .object({
    kind: z.literal("review"),
    articles: ScrapeArticlesV8Schema,
    article: z
      .object({
        canonicalUrl: ScrapePageFieldSchema.nullable(),
        title: ScrapePageFieldSchema,
        publishedDate: ScrapeDateFieldV8Schema,
        reviews: ScrapeReviewGroupsV8Schema,
      })
      .strict(),
  })
  .strict();

const ScrapeReviewGroupsV9Schema = z.union([
  z
    .object({
      inside: ScrapeSelectorSchema,
      oneReviewPer: z.literal("element"),
      selector: ScrapeSelectorSchema,
      contains: ScrapeSelectorSchema.nullable(),
      ...scrapeReviewFieldsV8,
    })
    .strict(),
  z
    .object({
      inside: ScrapeSelectorSchema,
      oneReviewPer: z.literal("section"),
      startsAt: ScrapeTextMarkerV8Schema,
      stopBefore: ScrapeTextMarkerV8Schema.nullable(),
      whenOnlyOneReview: z.enum(["startAtReview", "useWholeArea"]),
      ...scrapeReviewFieldsV8,
    })
    .strict(),
]);

const ScrapeReviewRulesV9Schema = z
  .object({
    kind: z.literal("review"),
    articles: ScrapeArticlesV9Schema,
    article: z
      .object({
        canonicalUrl: ScrapePageFieldSchema.nullable(),
        title: ScrapePageFieldSchema,
        publishedDate: ScrapeDateFieldV9Schema,
        reviews: ScrapeReviewGroupsV9Schema,
      })
      .strict(),
  })
  .strict();

const ScrapePriceRulesV9Schema = z
  .object({
    kind: z.literal("price"),
    products: ScrapeProductsV8Schema,
    product: z
      .object({
        name: ScrapePageFieldSchema,
        price: ScrapePageFieldSchema,
        currency: z.enum(CURRENCY_LIST),
        volume: ScrapePageFieldSchema,
        url: ScrapePageFieldSchema.nullable(),
        externalProductId: ScrapePageFieldSchema.nullable(),
        imageUrl: ScrapePageFieldSchema.nullable(),
        barcode: ScrapePageFieldSchema.nullable(),
      })
      .strict(),
  })
  .strict();

const ScrapeCatalogRulesV9Schema = z
  .object({
    kind: z.literal("catalog"),
    products: ScrapeProductsV8Schema,
    product: z
      .object({
        name: ScrapePageFieldSchema,
        url: ScrapePageFieldSchema.nullable(),
        externalProductId: ScrapePageFieldSchema.nullable(),
        imageUrl: ScrapePageFieldSchema.nullable(),
        volume: ScrapePageFieldSchema.nullable(),
        abv: ScrapePageFieldSchema.nullable(),
        statedAge: ScrapePageFieldSchema.nullable(),
        edition: ScrapePageFieldSchema.nullable(),
        releaseYear: ScrapePageFieldSchema.nullable(),
      })
      .strict(),
  })
  .strict();

export const ScrapeRulesV9Schema = z.discriminatedUnion("kind", [
  ScrapeReviewRulesV9Schema,
  ScrapePriceRulesV9Schema,
  ScrapeCatalogRulesV9Schema,
]);

export const ScrapeRulesV8Schema = z.discriminatedUnion("kind", [
  ScrapeReviewRulesV8Schema,
  ScrapePriceRulesV9Schema,
  ScrapeCatalogRulesV9Schema,
]);

export const ScrapeListSchema = z
  .object({
    links: ScrapeSelectorSchema.describe("Links to article or product pages."),
    nextPage: ScrapeSelectorSchema.nullable().describe(
      "The link to the next list page, or null.",
    ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(SCRAPE_SOURCE_MAX_ITEMS)
      .describe("Most articles or products to read in one run."),
  })
  .strict();

const ScrapeScoreV10Schema = z
  .object({
    selector: ScrapeSelectorSchema.describe("The displayed score."),
    outOf: z.number().positive().describe("The highest possible score."),
  })
  .strict();

function directReviewRulesSchema<T extends z.ZodType>(nameSchema: T) {
  return z
    .object({
      kind: z.literal("review"),
      list: ScrapeListSchema,
      detail: z
        .object({
          url: ScrapeSelectorSchema.nullable().describe(
            "The page's preferred URL, or null to use the fetched URL.",
          ),
          title: ScrapeSelectorSchema.describe("The article title."),
          date: ScrapeSelectorSchema.nullable().describe(
            "The published date, or null to use a standard page date or a date in the URL.",
          ),
          reviews: z
            .object({
              area: ScrapeSelectorSchema.describe(
                "The page area that contains the review text.",
              ),
              item: ScrapeSelectorSchema.nullable().describe(
                "The element around each review, or null when reviews have no separate elements.",
              ),
              name: nameSchema,
              reviewer: ScrapeSelectorSchema.nullable().describe(
                "The review writer, or null when no writer is shown.",
              ),
              tastingNotes: ScrapeSelectorSchema.nullable().describe(
                "A smaller area containing only tasting notes, or null.",
              ),
              score: ScrapeScoreV10Schema.nullable().describe(
                "The review score, or null when no score is shown.",
              ),
            })
            .strict(),
        })
        .strict(),
    })
    .strict();
}

const ScrapeReviewRulesV10Schema = directReviewRulesSchema(
  ScrapeSelectorSchema.nullable().describe(
    "The Bottle name, or null when one review uses the article title.",
  ),
);

const ScrapeReviewNameMatchSchema = ScrapeTextTemplateSchema.refine(
  (template) => template.includes("{value}"),
  { message: "A review name match must contain {value}." },
);

const ScrapeMatchedReviewNameSchema = z
  .object({
    selector: ScrapeSelectorSchema.nullable().describe(
      "The Bottle name, or null to use the article title.",
    ),
    match: ScrapeReviewNameMatchSchema.describe(
      "The selected text, with {value} where the Bottle name appears.",
    ),
  })
  .strict();

const ScrapeReviewNameSchema = z
  .union([ScrapeSelectorSchema, ScrapeMatchedReviewNameSchema])
  .nullable()
  .describe("How to read the Bottle name.");

const ScrapeReviewRulesV11Schema = directReviewRulesSchema(
  ScrapeReviewNameSchema,
);

const ScrapeVolumeV10Schema = z
  .union([ScrapeSelectorSchema, z.number().int().positive().max(100_000)])
  .describe("The volume selector or a fixed number of milliliters.");

const ScrapeProductFieldsV10Schema = z
  .object({
    name: ScrapeSelectorSchema.describe("The product name."),
    url: ScrapeSelectorSchema.nullable().describe(
      "The page's preferred product URL, or null to use the fetched URL.",
    ),
    id: ScrapeSelectorSchema.nullable().describe(
      "The website's stable product ID, or null.",
    ),
    image: ScrapeSelectorSchema.nullable().describe(
      "The product image URL, or null.",
    ),
    volume: ScrapeVolumeV10Schema.nullable().describe(
      "The volume, or null when no volume is shown.",
    ),
  })
  .strict();

const ScrapePriceRulesV10Schema = z
  .object({
    kind: z.literal("price"),
    list: ScrapeListSchema,
    detail: ScrapeProductFieldsV10Schema.extend({
      price: ScrapeSelectorSchema.describe("The displayed price."),
      currency: z.enum(CURRENCY_LIST).describe("The price currency."),
      volume: ScrapeVolumeV10Schema,
      barcode: ScrapeSelectorSchema.nullable().describe(
        "The product barcode, or null.",
      ),
    }).strict(),
  })
  .strict();

const ScrapeCatalogRulesV10Schema = z
  .object({
    kind: z.literal("catalog"),
    list: ScrapeListSchema,
    detail: ScrapeProductFieldsV10Schema.extend({
      abv: ScrapeSelectorSchema.nullable().describe("The ABV, or null."),
      age: ScrapeSelectorSchema.nullable().describe("The stated age, or null."),
      edition: ScrapeSelectorSchema.nullable().describe(
        "The edition name, or null.",
      ),
      year: ScrapeSelectorSchema.nullable().describe(
        "The release year, or null.",
      ),
    }).strict(),
  })
  .strict();

export const ScrapeRulesV10Schema = z.discriminatedUnion("kind", [
  ScrapeReviewRulesV10Schema,
  ScrapePriceRulesV10Schema,
  ScrapeCatalogRulesV10Schema,
]);

export const ScrapeReviewRulesSchema = ScrapeReviewRulesV11Schema;
export const ScrapePriceRulesSchema = ScrapePriceRulesV10Schema;
export const ScrapeCatalogRulesSchema = ScrapeCatalogRulesV10Schema;
export const ScrapeRulesV11Schema = z.discriminatedUnion("kind", [
  ScrapeReviewRulesV11Schema,
  ScrapePriceRulesV10Schema,
  ScrapeCatalogRulesV10Schema,
]);
export const ScrapeRulesSchema = ScrapeRulesV11Schema;

export const StoredScrapeRulesSchema = z.union([
  ScrapeRulesV1Schema,
  ScrapeRulesV3Schema,
  ScrapeRulesV6Schema,
  ScrapeRulesV7Schema,
  ScrapeRulesV8Schema,
  ScrapeRulesV9Schema,
  ScrapeRulesV10Schema,
  ScrapeRulesV11Schema,
]);

export type ScrapeRulesV3 = z.infer<typeof ScrapeRulesV3Schema>;
export type ScrapeRules = z.infer<typeof ScrapeRulesSchema>;
export type StoredScrapeRules = z.infer<typeof StoredScrapeRulesSchema>;
export type ScrapePageRead = z.infer<typeof ScrapePageReadSchema>;
type ScrapePageField = z.infer<typeof ScrapePageFieldSchema>;
type ScrapeReviewField = z.infer<typeof ScrapeReviewFieldSchema>;
export type StoredScrapePageRead =
  | z.infer<typeof ScrapePageReadV6Schema>
  | ScrapePageRead;
export type StoredScrapePageField =
  | z.infer<typeof ScrapePageFieldV6Schema>
  | ScrapePageField;
export type StoredScrapeReviewField =
  | z.infer<typeof ScrapeReviewFieldV6Schema>
  | ScrapeReviewField;
export type ScrapeValueSelectorV1 = z.infer<typeof ScrapeValueSelectorV1Schema>;
export type ScrapeValue = z.infer<typeof ScrapeValueSchema>;

export function normalizeScrapeReviewNameRule(
  name: z.infer<typeof ScrapeReviewNameSchema>,
) {
  const matched = ScrapeMatchedReviewNameSchema.safeParse(name);
  return matched.success
    ? matched.data
    : {
        selector: ScrapeSelectorSchema.nullable().parse(name),
        match: null,
      };
}
