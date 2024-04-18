import { z } from "zod";

import { TAG_CATEGORIES } from "../constants";
import { FlavorProfileEnum } from "./common";

export const TagCategoryEnum = z.enum(TAG_CATEGORIES);

export const TagSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  synonyms: z.array(z.string().trim().min(1, "Required")),
  tagCategory: TagCategoryEnum,
  flavorProfiles: z.array(FlavorProfileEnum),
});

export const TagInputSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  synonyms: z.array(z.string().trim().min(1, "Required")).default([]).nullish(),
  tagCategory: TagCategoryEnum,
  flavorProfiles: z.array(FlavorProfileEnum).default([]).nullish(),
});
