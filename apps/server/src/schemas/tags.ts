import { z } from "zod";

import { TAG_CATEGORIES } from "../constants";
import { FlavorProfileEnum } from "./common";

export const TagCategoryEnum = z.enum(TAG_CATEGORIES);

export const TagSchema = z.object({
  name: z.string().trim().min(1, "Required").describe("Name of the tag"),
  synonyms: z
    .array(z.string().trim().min(1, "Required"))
    .describe("Alternative names for this tag"),
  tagCategory: TagCategoryEnum.describe("Category this tag belongs to"),
  flavorProfiles: z
    .array(FlavorProfileEnum)
    .describe("Flavor profiles associated with this tag"),
});

export const TagInputSchema = z.object({
  name: z.string().trim().min(1, "Required").describe("Name of the tag"),
  synonyms: z
    .array(z.string().trim().min(1, "Required"))
    .default([])
    .nullish()
    .describe("Alternative names for this tag"),
  tagCategory: TagCategoryEnum.describe("Category this tag belongs to"),
  flavorProfiles: z
    .array(FlavorProfileEnum)
    .default([])
    .nullish()
    .describe("Flavor profiles associated with this tag"),
});
