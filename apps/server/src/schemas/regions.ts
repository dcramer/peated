import { z } from "zod";
import { ContentSourceEnum } from "./common";
import { CountrySchema } from "./countries";
import { PointSchema } from "./shared";

export const RegionSchema = z.object({
  id: z.number(),
  name: z.string().trim().min(1, "Required"),
  slug: z.string().trim().min(1, "Required"),
  country: CountrySchema,
  description: z.string().nullish(),
  location: PointSchema.nullish(),
  totalBottles: z.number(),
  totalDistillers: z.number(),
});

export const RegionInputSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  country: z.number(),
  description: z.string().trim().nullish(),
  descriptionSrc: ContentSourceEnum.nullish(),
});
