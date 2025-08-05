import { z } from "zod";
import { BadgeAwardSchema } from "./badges";
import { BottleReleaseSchema } from "./bottleReleases";
import { BottleSchema } from "./bottles";
import { ServingStyleEnum, zDatetime } from "./common";
import { UserSchema } from "./users";

export const TastingSchema = z.object({
  id: z.number().describe("Unique identifier for the tasting"),
  imageUrl: z
    .string()
    .nullable()
    .default(null)
    .readonly()
    .describe("URL to the tasting's image"),
  notes: z
    .string()
    .nullable()
    .default(null)
    .describe("User's tasting notes and observations"),
  bottle: BottleSchema.describe("The bottle that was tasted"),
  release: BottleReleaseSchema.nullable()
    .default(null)
    .describe(
      "The release of the bottle, if applicable. e.g. 'Ardbeg Supernova 2023'",
    ),
  rating: z
    .union([z.literal(-1), z.literal(1), z.literal(2)])
    .nullable()
    .default(null)
    .describe("Simple rating: -1 (Pass), 1 (Sip), 2 (Savor)"),
  tags: z
    .array(z.string())
    .default([])
    .describe("Tags associated with this tasting"),
  color: z
    .number()
    .gte(0)
    .lte(20)
    .nullable()
    .default(null)
    .describe("Color rating on a scale from 0-20"),
  servingStyle: ServingStyleEnum.nullable()
    .default(null)
    .describe("How the whisky was served (neat, rocks, etc.)"),
  friends: z
    .array(UserSchema)
    .default([])
    .describe("Friends who were present during this tasting"),

  awards: z
    .array(BadgeAwardSchema)
    .readonly()
    .describe("Badges awarded for this tasting"),
  comments: z
    .number()
    .gte(0)
    .readonly()
    .describe("Number of comments on this tasting"),
  toasts: z
    .number()
    .gte(0)
    .readonly()
    .describe("Number of toasts (likes) this tasting has received"),
  hasToasted: z
    .boolean()
    .optional()
    .readonly()
    .describe("Whether the current user has toasted this tasting"),

  createdAt: z
    .string()
    .datetime()
    .readonly()
    .describe("Timestamp when the tasting was created"),
  createdBy: UserSchema.readonly().describe("User who created this tasting"),
});

export const TastingInputSchema = TastingSchema.omit({
  id: true,
  awards: true,
  comments: true,
  toasts: true,
  hasToasted: true,
  createdBy: true,
}).extend({
  bottle: z.number().describe("ID of the bottle being tasted"),
  release: z
    .number()
    .nullish()
    .describe(
      "The release of the bottle, if applicable. e.g. 'Ardbeg Supernova 2023'",
    ),
  flight: z
    .string()
    .nullish()
    .describe("Flight ID if this tasting is part of a flight"),
  createdAt: zDatetime
    .nullish()
    .describe("Custom creation timestamp for the tasting"),
  image: z.null().optional().describe("Optional image upload for the tasting"),
  friends: z
    .array(z.number())
    .default([])
    .describe("Array of friend user IDs who were present"),
});
