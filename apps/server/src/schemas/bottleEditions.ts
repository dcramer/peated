import { z } from "zod";
import { CASK_FILLS, CASK_SIZE_IDS, CASK_TYPE_IDS } from "../constants";

export const BottleEditionSchema = z.object({
  id: z.number(),
  bottleId: z.number(),

  fullName: z.string(),
  name: z.string(),

  description: z.string().nullable(),
  tastingNotes: z
    .object({
      nose: z.string(),
      palate: z.string(),
      finish: z.string(),
    })
    .nullable(),

  statedAge: z.number().nullable(),
  caskStrength: z.boolean().nullable(),
  singleCask: z.boolean().nullable(),
  abv: z.number().nullable(),

  imageUrl: z.string().nullable(),

  vintageYear: z.number().nullable(),
  releaseYear: z.number().nullable(),

  caskType: z.enum(CASK_TYPE_IDS).nullable(),
  caskFill: z.enum(CASK_FILLS).nullable(),
  caskSize: z.enum(CASK_SIZE_IDS).nullable(),

  avgRating: z.number().nullable(),
  totalTastings: z.number(),

  suggestedTags: z.array(z.string()),
  hasTasted: z.boolean(),

  createdAt: z.string(),
  updatedAt: z.string(),
});
