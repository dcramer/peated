import { CURRENCY_LIST } from "@peated/server/constants";
import { z } from "zod";

export const SCRAPE_RULES_FORMAT_VERSION = 1;
// TODO(scraper-platform): Add event after scraped-event match and update rules are defined.
export const SCRAPE_SOURCE_KIND_LIST = ["review", "price"] as const;
// One list request plus every detail request must fit the 100-request run budget.
export const SCRAPE_SOURCE_MAX_ITEMS = 99;

const SelectorSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => !value.includes(":has("), {
    message: "The :has selector is not supported.",
  });

export const ScrapeValueSelectorSchema = z
  .object({
    selector: SelectorSchema,
    attribute: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

const ListRulesSchema = z
  .object({
    detailLink: ScrapeValueSelectorSchema,
    maxItems: z.number().int().min(1).max(SCRAPE_SOURCE_MAX_ITEMS).default(25),
  })
  .strict();

const ReviewRulesSchema = z
  .object({
    kind: z.literal("review"),
    list: ListRulesSchema,
    detail: z
      .object({
        title: ScrapeValueSelectorSchema,
        publishedAt: ScrapeValueSelectorSchema.optional(),
        reviewItem: SelectorSchema,
        name: ScrapeValueSelectorSchema,
        reviewerName: ScrapeValueSelectorSchema.optional(),
        reviewText: ScrapeValueSelectorSchema.optional(),
        score: z
          .object({
            value: ScrapeValueSelectorSchema,
            scale: z.number().positive(),
          })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .strict();

const PriceRulesSchema = z
  .object({
    kind: z.literal("price"),
    list: ListRulesSchema,
    detail: z
      .object({
        name: ScrapeValueSelectorSchema,
        price: ScrapeValueSelectorSchema,
        currency: z.enum(CURRENCY_LIST),
        volume: ScrapeValueSelectorSchema,
        url: ScrapeValueSelectorSchema.optional(),
        externalProductId: ScrapeValueSelectorSchema.optional(),
        imageUrl: ScrapeValueSelectorSchema.optional(),
        barcode: ScrapeValueSelectorSchema.optional(),
      })
      .strict(),
  })
  .strict();

export const ScrapeRulesSchema = z.discriminatedUnion("kind", [
  ReviewRulesSchema,
  PriceRulesSchema,
]);

export type ScrapeRules = z.infer<typeof ScrapeRulesSchema>;
export type ScrapeValueSelector = z.infer<typeof ScrapeValueSelectorSchema>;

/** Parses rules only with the interpreter that owns their stored format. */
export function parseScrapeRules(formatVersion: number, rules: ScrapeRules) {
  if (formatVersion !== SCRAPE_RULES_FORMAT_VERSION) {
    throw new Error(`Unsupported scrape rules format: ${formatVersion}.`);
  }
  return ScrapeRulesSchema.parse(rules);
}
