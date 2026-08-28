import { CURRENCY_LIST } from "@peated/server/constants";
import { z } from "zod";

export const ScrapeIssueSchema = z
  .object({
    field: z.string(),
    message: z.string(),
  })
  .strict();

const ReviewPageSchema = z
  .object({
    kind: z.literal("review"),
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

const PricePageSchema = z
  .object({
    kind: z.literal("price"),
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

export const ScrapeSourcePreviewPageSchema = z.discriminatedUnion("kind", [
  ReviewPageSchema,
  PricePageSchema,
]);

export const ScrapeSourceValidationSchema = z
  .object({
    issues: z.array(ScrapeIssueSchema),
    pages: z.array(ScrapeSourcePreviewPageSchema),
  })
  .strict();

export type ScrapeIssue = z.infer<typeof ScrapeIssueSchema>;
export type ScrapeSourcePreviewPage = z.infer<
  typeof ScrapeSourcePreviewPageSchema
>;
export type ScrapeSourceValidation = z.infer<
  typeof ScrapeSourceValidationSchema
>;
