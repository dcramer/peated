import { BottleExtractedDetailsSchema } from "@peated/bottle-classifier/contract";
import { z } from "zod";

export const AuctionLotStateSchema = z.enum([
  "upcoming",
  "live",
  "aftersale",
  "closed",
  "withdrawn",
  "unknown",
]);
export const AuctionOutcomeSchema = z.enum([
  "sold",
  "unsold",
  "cancelled",
  "unknown",
]);
export const AuctionPriceKindSchema = z.enum(["hammer", "aftersale"]);
const MoneySchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const CurrencySchema = z.enum(["gbp", "usd", "eur"]);
const SourceKeySchema = z.string().trim().min(1).max(255);
const UrlSchema = z
  .url()
  .refine((value) => ["https:", "http:"].includes(new URL(value).protocol));

export const AuctionResultInputSchema = z
  .object({
    outcome: AuctionOutcomeSchema,
    amount: MoneySchema.nullable(),
    currency: CurrencySchema.nullable(),
    priceKind: AuctionPriceKindSchema.nullable(),
    soldAt: z.iso.datetime({ offset: true }).nullable(),
    priceNote: z.string().max(500).nullable().default(null),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasPrice = value.amount !== null;
    if (
      hasPrice !== (value.currency !== null) ||
      hasPrice !== (value.priceKind !== null)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Amount, currency, and price kind must be supplied together.",
      });
    }
    if ((hasPrice || value.soldAt !== null) && value.outcome !== "sold") {
      ctx.addIssue({
        code: "custom",
        message: "Only a sold lot can have a sale price or sale time.",
      });
    }
  });

export const AuctionSourceSchema = z
  .object({
    sourceKey: SourceKeySchema,
    name: z.string().trim().min(1).max(500),
    url: UrlSchema,
    startsAt: z.iso.datetime({ offset: true }).nullable().optional(),
    endsAt: z.iso.datetime({ offset: true }).nullable().optional(),
  })
  .strict();

export const AuctionObservationSchema = z
  .object({
    auction: AuctionSourceSchema,
    lot: z
      .object({
        sourceKey: SourceKeySchema,
        lotNumber: z.string().max(255).nullable().optional(),
        name: z.string().trim().min(1).max(500),
        url: UrlSchema,
        imageUrl: UrlSchema.nullable().optional(),
        volume: z.number().int().positive().nullable().optional(),
        sourceBottleIdentity:
          BottleExtractedDetailsSchema.nullable().optional(),
        condition: z.string().max(2000).nullable().optional(),
        state: AuctionLotStateSchema,
        endsAt: z.iso.datetime({ offset: true }).nullable().optional(),
        currentBid: MoneySchema.nullable().optional(),
        bidCurrency: CurrencySchema.nullable().optional(),
        result: AuctionResultInputSchema.optional(),
      })
      .strict()
      .superRefine((value, ctx) => {
        if (value.currentBid !== undefined || value.bidCurrency !== undefined) {
          if (
            (value.currentBid === undefined) !==
              (value.bidCurrency === undefined) ||
            (value.currentBid != null) !== (value.bidCurrency != null)
          ) {
            ctx.addIssue({
              code: "custom",
              message: "Bid amount and currency must be supplied together.",
            });
          }
        }
        if (value.result?.outcome === "sold" && value.state !== "closed") {
          ctx.addIssue({
            code: "custom",
            message: "A sold lot must be closed.",
          });
        }
      }),
    observedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const AuctionResultSchema = z.object({
  id: z.number(),
  outcome: AuctionOutcomeSchema,
  amount: MoneySchema.nullable(),
  currency: CurrencySchema.nullable(),
  priceKind: AuctionPriceKindSchema.nullable(),
  soldAt: z.string().datetime().nullable(),
  priceNote: z.string().nullable(),
  observedAt: z.string().datetime(),
});

export const AuctionLotSchema = z.object({
  id: z.number(),
  bottleId: z.number().nullable(),
  auction: z.object({
    id: z.number(),
    name: z.string(),
    url: UrlSchema,
    site: z.object({ name: z.string(), type: z.string() }),
  }),
  lotNumber: z.string().nullable(),
  name: z.string(),
  url: UrlSchema,
  volume: z.number().nullable(),
  condition: z.string().nullable(),
  state: AuctionLotStateSchema,
  availability: z.enum([
    "live",
    "aftersale",
    "upcoming",
    "unavailable",
    "unknown",
  ]),
  endsAt: z.string().datetime().nullable(),
  currentBid: MoneySchema.nullable(),
  bidCurrency: CurrencySchema.nullable(),
  lastCheckedAt: z.string().datetime(),
  result: AuctionResultSchema.nullable(),
});

export type AuctionObservation = z.input<typeof AuctionObservationSchema>;
