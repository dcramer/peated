import { z } from "zod";
import { BottleSchema } from "./bottles";
import { CurrencyEnum } from "./common";
import { ExternalSiteSchema } from "./externalSites";

export const StorePriceSchema = z.object({
  id: z.number(),
  name: z.string(),
  price: z.number(),
  currency: CurrencyEnum,
  url: z.string(),
  volume: z.number(),
  site: ExternalSiteSchema.optional(),
  updatedAt: z.string().datetime(),
});

export const StorePriceInputSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  price: z.number(),
  currency: CurrencyEnum,
  volume: z.number(),
  url: z.string().trim().min(1, "Required"),
});

export const BottlePriceChangeSchema = z.object({
  id: z.number(),
  price: z.number(),
  previousPrice: z.number(),
  currency: CurrencyEnum,
  bottle: BottleSchema,
});
