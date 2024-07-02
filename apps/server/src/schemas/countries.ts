import { z } from "zod";
import { ContentSourceEnum } from "./common";
import { PointSchema } from "./shared";

export const CountrySchema = z.object({
  name: z.string().trim().min(1, "Required"),
  slug: z.string().trim().min(1, "Required"),
  description: z.string().nullish(),
  location: PointSchema.nullish(),
  totalBottles: z.number(),
  totalDistillers: z.number(),
});

export const CountryInputSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  slug: z.string().trim().min(1, "Required"),
  description: z.string().trim().nullish(),
  descriptionSrc: ContentSourceEnum.nullish(),
});
