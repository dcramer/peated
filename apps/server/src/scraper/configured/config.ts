import { CURRENCY_LIST } from "@peated/server/constants";
import { z } from "zod";

export const CONFIGURED_SCRAPER_ENGINE_VERSION = 1;

const SelectorSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => !value.includes(":has("), {
    message: "The :has selector is not supported.",
  });

export const ConfiguredValueSelectorSchema = z
  .object({
    selector: SelectorSchema,
    attribute: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

const IndexSchema = z
  .object({
    itemLink: ConfiguredValueSelectorSchema,
    maxItems: z.number().int().min(1).max(100).default(25),
  })
  .strict();

const ReviewConfigSchema = z
  .object({
    engineVersion: z.literal(CONFIGURED_SCRAPER_ENGINE_VERSION),
    collection: z.literal("reviews"),
    index: IndexSchema,
    detail: z
      .object({
        title: ConfiguredValueSelectorSchema,
        publishedAt: ConfiguredValueSelectorSchema.optional(),
        reviewItem: SelectorSchema,
        name: ConfiguredValueSelectorSchema,
        reviewerName: ConfiguredValueSelectorSchema.optional(),
        reviewText: ConfiguredValueSelectorSchema.optional(),
        score: z
          .object({
            value: ConfiguredValueSelectorSchema,
            scale: z.number().positive(),
          })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .strict();

const StorePriceConfigSchema = z
  .object({
    engineVersion: z.literal(CONFIGURED_SCRAPER_ENGINE_VERSION),
    collection: z.literal("store_prices"),
    index: IndexSchema,
    detail: z
      .object({
        name: ConfiguredValueSelectorSchema,
        price: ConfiguredValueSelectorSchema,
        currency: z.enum(CURRENCY_LIST),
        volume: ConfiguredValueSelectorSchema,
        url: ConfiguredValueSelectorSchema.optional(),
        externalProductId: ConfiguredValueSelectorSchema.optional(),
        imageUrl: ConfiguredValueSelectorSchema.optional(),
        barcode: ConfiguredValueSelectorSchema.optional(),
      })
      .strict(),
  })
  .strict();

export const ConfiguredScraperConfigSchema = z.discriminatedUnion(
  "collection",
  [ReviewConfigSchema, StorePriceConfigSchema],
);

export type ConfiguredScraperConfig = z.infer<
  typeof ConfiguredScraperConfigSchema
>;
export type ConfiguredValueSelector = z.infer<
  typeof ConfiguredValueSelectorSchema
>;
