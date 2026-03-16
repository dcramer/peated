import { z } from "zod";
import { SIMPLE_RATING_VALUES } from "../constants";
import { BadgeAwardSchema } from "./badges";
import { BottleReleaseSchema } from "./bottleReleases";
import { BottleSchema } from "./bottles";
import { ServingStyleEnum, zDatetime } from "./common";
import { UserSchema } from "./users";

const MAX_YEAR = new Date().getFullYear() + 1;

export const TastingBottleDetailsSchema = z
  .object({
    edition: z.string().trim().min(1).max(64).optional(),
    vintageYear: z.number().int().gte(1800).lte(MAX_YEAR).optional(),
    releaseYear: z.number().int().gte(1800).lte(MAX_YEAR).optional(),
    abv: z.number().min(0).max(100).optional(),
    singleCask: z.boolean().optional(),
    caskStrength: z.boolean().optional(),
    caskNumber: z.string().trim().min(1).max(64).optional(),
    bottleNumber: z.string().trim().min(1).max(64).optional(),
    outturn: z.string().trim().min(1).max(64).optional(),
    exclusiveText: z.string().trim().min(1).max(255).optional(),
    labelNotes: z.string().trim().min(1).max(255).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one bottle detail",
  });

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
  bottleDetails: TastingBottleDetailsSchema.nullable()
    .default(null)
    .describe(
      "Optional exact bottle details for this tasting when the shared release is missing or not specific enough",
    ),
  rating: z
    .union([
      z.literal(SIMPLE_RATING_VALUES.PASS),
      z.literal(SIMPLE_RATING_VALUES.SIP),
      z.literal(SIMPLE_RATING_VALUES.SAVOR),
    ])
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
