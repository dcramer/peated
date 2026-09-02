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
  notedTastings: z.number().int().nonnegative(),
  categories: z.array(
    z.object({
      category: z.enum(TAG_CATEGORIES),
      tastingCount: z.number().int().nonnegative(),
      notes: z
        .array(
          z.object({
            name: z.string(),
            tastingCount: z.number().int().positive(),
          }),
        )
        .max(2),
    }),
  ),
});

export type BottleFlavorProfile = z.infer<typeof BottleFlavorProfileSchema>;
