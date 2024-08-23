import { z } from "zod";
import { BottleSchema } from "./bottles";
import { CurrencyEnum } from "./common";
import { ExternalSiteSchema } from "./externalSites";

const ALLOWED_VOLUMES = [500, 750, 1000];

export const StorePriceSchema = z.object({
  id: z.number(),
  name: z.string(),
  price: z.number(),
  currency: CurrencyEnum,
  url: z.string(),
  volume: z.number(),
  site: ExternalSiteSchema.optional(),
  updatedAt: z.string().datetime(),
  imageUrl: z.string().trim().url().nullable().default(null).readonly(),
});

export const StorePriceInputSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  price: z.number(),
  currency: CurrencyEnum,
  volume: z.number().refine((val) => ALLOWED_VOLUMES.includes(val), {
    message: `Volume must be one of: ${ALLOWED_VOLUMES.join(", ")}`,
  }),
  url: z.string().trim().url().min(1, "Required"),
  imageUrl: z.string().trim().url().nullable().default(null),
});

export const BottlePriceChangeSchema = z.object({
  id: z.number(),
  price: z.number(),
  previousPrice: z.number(),
  currency: CurrencyEnum,
  bottle: BottleSchema,
});
