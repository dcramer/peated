import { CURRENCY_LIST } from "@peated/server/constants";
import type { JsonValue } from "@peated/server/scraper/types";
import { z } from "zod";

export const SCRAPE_RULES_VERSION_1 = 1;
export const SCRAPE_RULES_VERSION_2 = 2;
export const SCRAPE_RULES_VERSION_3 = 3;
export const SCRAPE_RULES_VERSION_4 = 4;
export const SCRAPE_RULES_VERSION_5 = 5;
export const SCRAPE_RULES_VERSION = 6;
// TODO(scraper-platform): Add event after scraped-event match and update rules are defined.
export const SCRAPE_SOURCE_KIND_LIST = ["review", "price"] as const;
export type ScrapeSourceKind = (typeof SCRAPE_SOURCE_KIND_LIST)[number];
export const SCRAPE_SOURCE_MAX_LIST_PAGES = 5;
export const SCRAPE_SOURCE_DEFAULT_MAX_ITEMS = 25;
export const SCRAPE_SOURCE_MAX_ITEMS = 99;

const SCRAPE_VALUE_MAX_LENGTH = 200;
const SCRAPE_LITERAL_MAX_LENGTH = 100;
const SCRAPE_LITERAL_MAX_ITEMS = 10;
const SCRAPE_SCORE_MAP_MAX_ITEMS = 25;

export const ScrapeSelectorSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => !value.includes(":has("), {
    message: "The :has selector is not supported.",
  });

export const ScrapeAttributeSchema = z.string().trim().min(1).max(100);

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

export const ScrapeValueSelectorV1Schema = z
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

export const ScrapeListExclusionSchema = z
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

export const ScrapeUrlDateSchema = z
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
  .superRefine((score, context) => {
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
  });

const ScrapeScoreWithFirstReviewSchema = ScrapeScoreSchema.safeExtend({
  firstReviewFallback: ScrapeValueSchema.optional(),
});

export const ScrapeReviewSectionSchema = z
  .object({
    start: ScrapeSelectorSchema,
    endBefore: ScrapeSelectorSchema.optional(),
  })
  .strict();

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

export const ScrapeRulesV2Schema = z.discriminatedUnion("kind", [
  reviewRulesSchema(ScrapeValueSchema, ListRulesSchema),
  priceRulesSchema(ScrapeValueSchema, ListRulesSchema),
]);

export const ScrapeRulesV3Schema = z.discriminatedUnion("kind", [
  legacyReviewRulesSchema(ScrapeSelectorSchema, ScrapeScoreSchema),
  priceRulesSchema(ScrapeValueSchema, ListRulesSchema),
]);

export const ScrapeRulesV4Schema = z.discriminatedUnion("kind", [
  legacyReviewRulesSchema(
    z.union([ScrapeSelectorSchema, ScrapeReviewSectionSchema]),
    ScrapeScoreSchema,
  ),
  priceRulesSchema(ScrapeValueSchema, ListRulesSchema),
]);

export const ScrapeRulesV5Schema = z.discriminatedUnion("kind", [
  legacyReviewRulesSchema(
    z.union([ScrapeSelectorSchema, ScrapeReviewSectionSchema]),
    ScrapeScoreWithFirstReviewSchema,
  ),
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

export const ScrapePageReadSchema = z.union([
  ScrapeTextReadV6Schema,
  ScrapeAttributeReadV6Schema,
  ScrapeFixedReadV6Schema,
]);

const ReviewUseSchema = z.enum(["firstReview", "everyReview"]);
const ScrapeReviewReadSchema = z.union([
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
const ScrapeReviewTrySchema = z.array(ScrapeReviewReadSchema).min(1).max(3);

export const ScrapePageFieldSchema = z
  .object({
    try: z.array(ScrapePageReadSchema).min(1).max(3),
  })
  .strict();

export const ScrapeReviewFieldSchema = z
  .object({
    try: ScrapeReviewTrySchema,
  })
  .strict();

const ScrapeDateFieldV6Schema = z
  .object({
    try: z
      .array(z.union([ScrapePageReadSchema, ScrapeDateFromUrlV6Schema]))
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

const ScrapeScoreV6Schema = z
  .object({
    try: ScrapeReviewTrySchema,
    scale: z.number().positive(),
    map: z
      .array(ScrapeScoreMapEntrySchema)
      .min(1)
      .max(SCRAPE_SCORE_MAP_MAX_ITEMS)
      .nullable(),
  })
  .strict()
  .superRefine((score, context) => {
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
  });

const scrapeReviewFieldsV6 = {
  name: ScrapeReviewFieldSchema,
  reviewer: ScrapeReviewFieldSchema.nullable(),
  tastingNotes: ScrapeReviewFieldSchema.nullable(),
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

export const ScrapeReviewRulesSchema = z
  .object({
    kind: z.literal("review"),
    articles: ScrapeArticlesV6Schema,
    article: z
      .object({
        canonicalUrl: ScrapePageFieldSchema.nullable(),
        title: ScrapePageFieldSchema,
        publishedDate: ScrapeDateFieldV6Schema,
        reviews: ScrapeReviewGroupsV6Schema,
      })
      .strict(),
  })
  .strict();

export const ScrapePriceRulesSchema = z
  .object({
    kind: z.literal("price"),
    products: ScrapeProductsV6Schema,
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

export const ScrapeRulesSchema = z.discriminatedUnion("kind", [
  ScrapeReviewRulesSchema,
  ScrapePriceRulesSchema,
]);

export const StoredScrapeRulesSchema = z.union([
  ScrapeRulesV1Schema,
  ScrapeRulesV2Schema,
  ScrapeRulesV3Schema,
  ScrapeRulesV4Schema,
  ScrapeRulesV5Schema,
  ScrapeRulesSchema,
]);

export type ScrapeRulesV1 = z.infer<typeof ScrapeRulesV1Schema>;
export type ScrapeRulesV5 = z.infer<typeof ScrapeRulesV5Schema>;
export type ScrapeRules = z.infer<typeof ScrapeRulesSchema>;
export type StoredScrapeRules = z.infer<typeof StoredScrapeRulesSchema>;
export type ScrapePageRead = z.infer<typeof ScrapePageReadSchema>;
export type ScrapePageField = z.infer<typeof ScrapePageFieldSchema>;
export type ScrapeReviewField = z.infer<typeof ScrapeReviewFieldSchema>;
export type ScrapeValueSelectorV1 = z.infer<typeof ScrapeValueSelectorV1Schema>;
export type ScrapeValue = z.infer<typeof ScrapeValueSchema>;
export type ScrapeListExclusion = z.infer<typeof ScrapeListExclusionSchema>;

/** Parses rules only with the interpreter contract that owns their stored version. */
export function parseScrapeRules(
  rulesVersion: number,
  rules: StoredScrapeRules | JsonValue,
) {
  if (rulesVersion === SCRAPE_RULES_VERSION_1) {
    return ScrapeRulesV1Schema.parse(rules);
  }
  if (rulesVersion === SCRAPE_RULES_VERSION_2) {
    return ScrapeRulesV2Schema.parse(rules);
  }
  if (rulesVersion === SCRAPE_RULES_VERSION_3) {
    return ScrapeRulesV3Schema.parse(rules);
  }
  if (rulesVersion === SCRAPE_RULES_VERSION_4) {
    return ScrapeRulesV4Schema.parse(rules);
  }
  if (rulesVersion === SCRAPE_RULES_VERSION_5) {
    return ScrapeRulesV5Schema.parse(rules);
  }
  if (rulesVersion === SCRAPE_RULES_VERSION) {
    return ScrapeRulesSchema.parse(rules);
  }
  throw new Error(`Unsupported scrape rules version: ${rulesVersion}.`);
}

export function scrapeRulesLimit(rules: StoredScrapeRules) {
  if ("articles" in rules) return rules.articles.limit;
  if ("products" in rules) return rules.products.limit;
  return rules.list.maxItems;
}

export function withScrapeRulesLimit(
  rules: StoredScrapeRules,
  requestedLimit: number,
): StoredScrapeRules {
  const limit = Math.min(scrapeRulesLimit(rules), requestedLimit);
  if ("articles" in rules) {
    return { ...rules, articles: { ...rules.articles, limit } };
  }
  if ("products" in rules) {
    return { ...rules, products: { ...rules.products, limit } };
  }
  return { ...rules, list: { ...rules.list, maxItems: limit } };
}
