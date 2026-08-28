import { CURRENCY_LIST } from "@peated/server/constants";
import { z } from "zod";

export const ConfiguredParseIssueSchema = z
  .object({
    field: z.string(),
    message: z.string(),
  })
  .strict();

const ReviewPageSchema = z
  .object({
    collection: z.literal("reviews"),
    url: z.url(),
    title: z.string(),
    publishedAt: z.string().datetime().nullable(),
    reviews: z.array(
      z
        .object({
          name: z.string(),
          reviewerName: z.string().nullable(),
          nativeScore: z
            .object({
              value: z.number(),
              scale: z.number().positive(),
              display: z.string(),
            })
            .strict()
            .nullable(),
        })
        .strict(),
    ),
  })
  .strict();

const StorePricePageSchema = z
  .object({
    collection: z.literal("store_prices"),
    url: z.url(),
    products: z.array(
      z
        .object({
          externalProductId: z.string().nullable(),
          name: z.string(),
          price: z.number().int().positive(),
          currency: z.enum(CURRENCY_LIST),
          volume: z.number().int().positive(),
          url: z.url(),
          imageUrl: z.url().nullable(),
          barcode: z.string().nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export const ConfiguredScraperPreviewPageSchema = z.discriminatedUnion(
  "collection",
  [ReviewPageSchema, StorePricePageSchema],
);

export const ConfiguredScraperValidationSchema = z
  .object({
    issues: z.array(ConfiguredParseIssueSchema),
    pages: z.array(ConfiguredScraperPreviewPageSchema),
  })
  .strict();

export type ConfiguredParseIssue = z.infer<typeof ConfiguredParseIssueSchema>;
export type ConfiguredScraperPreviewPage = z.infer<
  typeof ConfiguredScraperPreviewPageSchema
>;
export type ConfiguredScraperValidation = z.infer<
  typeof ConfiguredScraperValidationSchema
>;
