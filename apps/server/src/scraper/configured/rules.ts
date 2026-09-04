import { CURRENCY_LIST } from "@peated/server/constants";
import type { JsonValue } from "@peated/server/scraper/types";
import { z } from "zod";

export const SCRAPE_RULES_VERSION_1 = 1;
export const SCRAPE_RULES_VERSION = 2;
// TODO(scraper-platform): Add event after scraped-event match and update rules are defined.
export const SCRAPE_SOURCE_KIND_LIST = ["review", "price"] as const;
export type ScrapeSourceKind = (typeof SCRAPE_SOURCE_KIND_LIST)[number];
export const SCRAPE_SOURCE_MAX_LIST_PAGES = 5;
export const SCRAPE_SOURCE_DEFAULT_MAX_ITEMS = 25;
export const SCRAPE_SOURCE_MAX_ITEMS = 99;

const SCRAPE_VALUE_MAX_LENGTH = 200;
const SCRAPE_LITERAL_MAX_LENGTH = 100;
const SCRAPE_LITERAL_MAX_ITEMS = 10;

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

const ListRulesSchema = z
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

function reviewRulesSchema<T extends z.ZodType>(valueSchema: T) {
  return z
    .object({
      kind: z.literal("review"),
      list: ListRulesSchema,
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

function priceRulesSchema<T extends z.ZodType>(valueSchema: T) {
  return z
    .object({
      kind: z.literal("price"),
      list: ListRulesSchema,
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
  reviewRulesSchema(ScrapeValueSelectorV1Schema),
  priceRulesSchema(ScrapeValueSelectorV1Schema),
]);

export const ScrapeRulesSchema = z.discriminatedUnion("kind", [
  reviewRulesSchema(ScrapeValueSchema),
  priceRulesSchema(ScrapeValueSchema),
]);

export const StoredScrapeRulesSchema = z.union([
  ScrapeRulesV1Schema,
  ScrapeRulesSchema,
]);

export type ScrapeRulesV1 = z.infer<typeof ScrapeRulesV1Schema>;
export type ScrapeRules = z.infer<typeof ScrapeRulesSchema>;
export type StoredScrapeRules = z.infer<typeof StoredScrapeRulesSchema>;
export type ScrapeValueSelectorV1 = z.infer<typeof ScrapeValueSelectorV1Schema>;
export type ScrapeValue = z.infer<typeof ScrapeValueSchema>;

/** Parses rules only with the interpreter contract that owns their stored version. */
export function parseScrapeRules(
  rulesVersion: number,
  rules: StoredScrapeRules | JsonValue,
) {
  if (rulesVersion === SCRAPE_RULES_VERSION_1) {
    return ScrapeRulesV1Schema.parse(rules);
  }
  if (rulesVersion === SCRAPE_RULES_VERSION) {
    return ScrapeRulesSchema.parse(rules);
  }
  throw new Error(`Unsupported scrape rules version: ${rulesVersion}.`);
}
