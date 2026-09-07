import { TAG_CATEGORIES } from "@peated/server/constants";
import { z } from "zod";

export const FlavorProfileSchema = z.object({
  totalBottles: z.number().int().nonnegative(),
  notedBottles: z.number().int().nonnegative(),
  categories: z.array(
    z.object({
      category: z.enum(TAG_CATEGORIES),
      bottleCount: z.number().int().nonnegative(),
      notes: z
        .array(
          z.object({
            name: z.string(),
            bottleCount: z.number().int().positive(),
          }),
        )
        .max(2),
    }),
  ),
});

export type FlavorProfile = z.infer<typeof FlavorProfileSchema>;

export const BottleFlavorProfileSchema = z.object({
  notedReviewAndTastingCount: z.number().int().nonnegative(),
  /** @deprecated Use notedReviewAndTastingCount. TODO(api-v1): Remove when /v1 is retired. */
  notedTastings: z.number().int().nonnegative(),
  categories: z.array(
    z.object({
      category: z.enum(TAG_CATEGORIES),
      reviewAndTastingCount: z.number().int().nonnegative(),
      /** @deprecated Use reviewAndTastingCount. TODO(api-v1): Remove when /v1 is retired. */
      tastingCount: z.number().int().nonnegative(),
      notes: z
        .array(
          z.object({
            name: z.string(),
            reviewAndTastingCount: z.number().int().positive(),
            /** @deprecated Use reviewAndTastingCount. TODO(api-v1): Remove when /v1 is retired. */
            tastingCount: z.number().int().positive(),
          }),
        )
        .max(2),
    }),
  ),
});

export type BottleFlavorProfile = z.infer<typeof BottleFlavorProfileSchema>;
