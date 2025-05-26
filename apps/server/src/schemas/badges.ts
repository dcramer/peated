import { z } from "zod";

import {
  BADGE_CHECK_TYPE_LIST,
  BADGE_FORMULA_LIST,
  BADGE_TRACKER_LIST,
} from "../constants";
import { AgeCheckConfigSchema } from "../lib/badges/checks/ageCheck";
import { BottleCheckConfigSchema } from "../lib/badges/checks/bottleCheck";
import { CategoryCheckConfigSchema } from "../lib/badges/checks/categoryCheck";
import { EntityCheckConfigSchema } from "../lib/badges/checks/entityCheck";
import { RegionCheckConfigSchema } from "../lib/badges/checks/regionCheck";

export const BadgeCheckTypeEnum = z.enum(BADGE_CHECK_TYPE_LIST);

export const BadgeTrackerEnum = z.enum(BADGE_TRACKER_LIST);

export const BadgeFormulaEnum = z.enum(BADGE_FORMULA_LIST);

// const BaseSchema = z.object({
//   id: z.number(),
//   name: z.string().trim().min(1, "Required"),
//   maxLevel: z.number().min(1).max(100).default(25),
// });

export const BadgeCheckSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("age").describe("Age-based badge check"),
    config: AgeCheckConfigSchema.describe("Configuration for age-based checks"),
  }),
  z.object({
    type: z.literal("entity").describe("Entity-based badge check"),
    config: EntityCheckConfigSchema.describe(
      "Configuration for entity-based checks",
    ),
  }),
  z.object({
    type: z.literal("bottle").describe("Bottle-based badge check"),
    config: BottleCheckConfigSchema.describe(
      "Configuration for bottle-based checks",
    ),
  }),
  z.object({
    type: z.literal("region").describe("Region-based badge check"),
    config: RegionCheckConfigSchema.describe(
      "Configuration for region-based checks",
    ),
  }),
  z.object({
    type: z.literal("category").describe("Category-based badge check"),
    config: CategoryCheckConfigSchema.describe(
      "Configuration for category-based checks",
    ),
  }),
  z.object({
    type: z
      .literal("everyTasting")
      .describe("Check that applies to every tasting"),
    config: z
      .any()
      .default({})
      .describe("Configuration for every-tasting checks"), // TODO
  }),
]);

export const BadgeCheckInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("age"),
    config: AgeCheckConfigSchema.partial(),
  }),
  z.object({
    type: z.literal("entity"),
    config: EntityCheckConfigSchema.partial(),
  }),
  z.object({
    type: z.literal("bottle"),
    config: BottleCheckConfigSchema.partial(),
  }),
  z.object({
    type: z.literal("region"),
    config: RegionCheckConfigSchema.partial(),
  }),
  z.object({
    type: z.literal("category"),
    config: CategoryCheckConfigSchema.partial(),
  }),
  z.object({
    type: z.literal("everyTasting"),
    config: z.any().default({}), // TODO
  }),
]);

export const BadgeSchema = z.object({
  id: z.number().describe("Unique identifier for the badge"),
  name: z.string().trim().min(1, "Required").describe("Name of the badge"),
  maxLevel: z
    .number()
    .min(1)
    .max(100)
    .default(25)
    .describe("Maximum level this badge can reach"),
  imageUrl: z
    .string()
    .nullable()
    .default(null)
    .describe("URL to the badge's image"),

  // only shown to admin so badges are 'secret' to users
  checks: z
    .array(BadgeCheckSchema)
    .min(1, "At least one check is required.")
    .optional()
    .describe("Array of checks that determine badge progression"),
  tracker: BadgeTrackerEnum.optional().describe(
    "Type of tracker used for this badge",
  ),
  formula: BadgeFormulaEnum.optional().describe(
    "Formula used to calculate badge progression",
  ),
});

export const BadgeInputSchema = BadgeSchema.omit({
  id: true,
  imageUrl: true,
}).required({
  checks: true,
  tracker: true,
  formula: true,
});

export const BadgeAwardSchema = z.object({
  id: z.number().describe("Unique identifier for the badge award"),
  xp: z.number().describe("Experience points earned for this badge"),
  level: z.number().describe("Current level of this badge"),
  badge: BadgeSchema.describe("The badge that was awarded"),
  createdAt: z
    .string()
    .datetime()
    .describe("Timestamp when the badge was awarded"),

  prevLevel: z.number().optional().describe("Previous level before this award"),
});
