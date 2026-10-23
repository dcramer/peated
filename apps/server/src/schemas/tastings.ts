import { JSON_SCHEMA_INPUT_REGISTRY } from "@orpc/zod/zod4";
import {
  BottleCandidateSchema,
  ImageBottleEvidenceSchema,
} from "@peated/bottle-classifier/contract";
import { z } from "zod";
import { RATING_BAND_IDS, SIMPLE_RATING_VALUES } from "../constants";
import { isDistantFuture } from "../lib/dates";
import { BadgeAwardSchema } from "./badges";
import { BottleSchema } from "./bottles";
import { CategoryEnum, ServingStyleEnum } from "./common";
import { PendingUploadSchema } from "./pendingUploads";
import { TagCategoriesSchema } from "./tags";
import { UserSchema } from "./users";

const TastingNotesSchema = z
  .string()
  .nullable()
  .default(null)
  .describe("User's tasting notes and observations");
const TastingRatingSchema = z
  .union([
    z.literal(SIMPLE_RATING_VALUES.PASS),
    z.literal(SIMPLE_RATING_VALUES.SIP),
    z.literal(SIMPLE_RATING_VALUES.SAVOR),
  ])
  .nullable()
  .default(null)
  .describe("Historical simple rating: -1 (Pass), 1 (Sip), 2 (Savor)");
const TastingBandSchema = z
  .enum(RATING_BAND_IDS)
  .nullable()
  .default(null)
  .describe(
    "Rating category for this tasting: Mediocre, Good, Very good, Outstanding, or Unicorn. Stored as a category, not a numeric review score.",
  );
const TastingTagsSchema = z
  .array(z.string())
  .default([])
  .describe("Tags associated with this tasting");
const TastingColorSchema = z
  .number()
  .gte(0)
  .lte(20)
  .nullable()
  .default(null)
  .describe("Color rating on a scale from 0-20");
const TastingServingStyleSchema = ServingStyleEnum.nullable()
  .default(null)
  .describe("How the whisky was served (neat, rocks, etc.)");
const TastingImageInputSchema = z
  .null()
  .optional()
  .describe(
    "Set to `null` to remove the tasting image when updating. Use the tasting image endpoint to upload a photo.",
  );

export const TastingSchema = z.object({
  id: z.number().describe("Unique identifier for the tasting"),
  imageUrl: z
    .string()
    .nullable()
    .default(null)
    .readonly()
    .describe("URL to the tasting's image"),
  notes: TastingNotesSchema,
  bottle: BottleSchema.describe("Bottle that was tasted"),
  ratingBand: TastingBandSchema,
  // TODO(ratings): Remove these fields when historical rating display is retired.
  legacySimpleRating: TastingRatingSchema.readonly(),
  legacyStarRating: z.number().nullable().default(null).readonly(),
  tags: TastingTagsSchema,
  tagCategories: TagCategoriesSchema,
  color: TastingColorSchema,
  servingStyle: TastingServingStyleSchema,
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

  tastedAt: z
    .string()
    .datetime()
    .readonly()
    .describe("When the member had the dram"),
  createdAt: z
    .string()
    .datetime()
    .readonly()
    .describe("When the tasting was posted. Feeds sort by this time"),
  createdBy: UserSchema.readonly().describe("User who created this tasting"),
});

// Any past time is allowed so people can post drams they had long ago.
// Feeds sort by post time, so backdating cannot move a tasting up the feed.
export const TastedAtInputSchema = z
  .string()
  .datetime()
  .refine((value) => !isDistantFuture(new Date(value), 60 * 5), {
    message: "Value too far in future.",
  });

export const TastingContentInputSchema = TastingSchema.omit({
  id: true,
  bottle: true,
  awards: true,
  comments: true,
  toasts: true,
  hasToasted: true,
  createdBy: true,
  createdAt: true,
  legacySimpleRating: true,
  legacyStarRating: true,
  tagCategories: true,
}).extend({
  flight: z
    .string()
    .nullish()
    .describe("Flight ID if this tasting is part of a flight"),
  tastedAt: TastedAtInputSchema.nullish().describe(
    "When the member had the dram. Defaults to the time of posting",
  ),
  idempotencyKey: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .optional()
    .describe(
      "Key chosen by the client for this post. Sending the same key again returns the tasting it created instead of a new one",
    ),
  image: TastingImageInputSchema,
  pendingImageId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Pending image upload to attach to the tasting"),
  friends: z
    .array(z.number())
    .default([])
    .describe("Array of friend user IDs who were present"),
});

export const TastingInputSchema = TastingContentInputSchema.extend({
  bottle: z.number().int().positive().describe("Bottle being tasted"),
}).strict();

export const TastingUpdateFields = {
  notes: TastingNotesSchema.removeDefault().optional(),
  ratingBand: TastingBandSchema.removeDefault().optional(),
  servingStyle: TastingServingStyleSchema.removeDefault().optional(),
  color: TastingColorSchema.removeDefault().optional(),
  friends: z.array(z.number()).optional(),
  tags: TastingTagsSchema.removeDefault().optional(),
  image: TastingImageInputSchema,
} as const;

export const PhotoIdentificationSuggestedNextStepEnum = z.enum([
  "confirm_match",
  "confirm_create",
  "manual_search",
]);

const PhotoIdentificationFileSchema = z
  .file()
  .describe("Bottle label image to identify");

JSON_SCHEMA_INPUT_REGISTRY.add(PhotoIdentificationFileSchema, {
  format: "binary",
  contentMediaType: "image/*",
});

export const PhotoIdentificationInputSchema = z.object({
  file: PhotoIdentificationFileSchema,
  idempotencyKey: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .describe("Client retry key for reusing an existing pending upload"),
});

export const PhotoIdentificationDiagnosticsSchema = z.object({
  extraction: z.object({
    status: z.enum(["found", "empty"]),
    summary: z.string().nullable().default(null),
  }),
  candidates: z.object({
    count: z.number().int().min(0),
  }),
  classification: z.object({
    status: z.enum(["ignored", "classified"]),
    action: z.string().nullable().default(null),
    confidence: z.number().nullable().default(null),
    reason: z.string().nullable().default(null),
  }),
});

const PhotoIdentificationCandidateSchema = BottleCandidateSchema.pick({
  fullName: true,
});

export const PhotoIdentificationProposedBottleSchema = z.object({
  name: z.string().trim().min(1),
  series: z
    .object({
      id: z.number().int().nullable(),
      name: z.string().trim().min(1),
    })
    .nullable(),
  category: CategoryEnum.nullable(),
  edition: z.string().nullable(),
  statedAge: z.number().nullable(),
  abv: z.number().nullable(),
  caskStrength: z.boolean().nullable(),
  singleCask: z.boolean().nullable(),
  maturation: z.string().nullable(),
  caskNumber: z.string().nullable(),
  outturn: z.number().int().positive().nullable(),
  vintageYear: z.number().nullable(),
  bottlingYear: z.number().nullable().optional(),
  releaseYear: z.number().nullable(),
  brand: z.object({
    id: z.number().int().nullable(),
    name: z.string().trim().min(1),
  }),
  distillers: z.array(
    z.object({
      id: z.number().int().nullable(),
      name: z.string().trim().min(1),
    }),
  ),
  bottler: z
    .object({
      id: z.number().int().nullable(),
      name: z.string().trim().min(1),
    })
    .nullable(),
});

export const PhotoIdentificationDecisionSchema = z.discriminatedUnion(
  "action",
  [
    z.object({
      action: z.literal("match"),
      matchedBottle: BottleSchema,
    }),
    z.object({
      action: z.literal("create_bottle"),
      proposedBottle: PhotoIdentificationProposedBottleSchema,
    }),
    z.object({
      action: z.literal("no_match"),
    }),
  ],
);

export const PhotoIdentificationClassificationSchema = z.discriminatedUnion(
  "status",
  [
    z.object({
      status: z.literal("ignored"),
      reason: z.string().min(1),
      artifacts: z.object({
        candidates: z.array(PhotoIdentificationCandidateSchema),
      }),
    }),
    z.object({
      status: z.literal("classified"),
      decision: PhotoIdentificationDecisionSchema,
      artifacts: z.object({
        candidates: z.array(PhotoIdentificationCandidateSchema),
      }),
    }),
  ],
);

const PhotoIdentificationPendingImageSchema = PendingUploadSchema.pick({
  id: true,
  imageUrl: true,
  expiresAt: true,
});

export const PhotoIdentificationSchema = z.object({
  pendingImage: PhotoIdentificationPendingImageSchema,
  imageEvidence: ImageBottleEvidenceSchema,
  classification: PhotoIdentificationClassificationSchema,
  suggestedNextStep: PhotoIdentificationSuggestedNextStepEnum,
  diagnostics: PhotoIdentificationDiagnosticsSchema,
  createToken: z
    .string()
    .nullable()
    .describe("Signed token for creating an auto-approved photo proposal"),
  wrongMatchToken: z
    .string()
    .nullable()
    .describe(
      "Signed token for reporting a matched Bottle as wrong, or `null` when there is no match",
    ),
});

/** The generic steps a member sees while the classifier works. */
export const PhotoIdentificationStepEnum = z.enum([
  "checking_peated",
  "checking_web",
  "comparing",
]);

/** Most likely-match Bottles one photo lookup progress event may carry. */
export const PHOTO_IDENTIFICATION_MAX_PROGRESS_CANDIDATES = 5;

/**
 * Progress sent while a photo is identified. The stream ends with the full
 * PhotoIdentificationSchema result.
 */
export const PhotoIdentificationProgressSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("photo"),
    pendingImage: PhotoIdentificationPendingImageSchema,
  }),
  z.object({
    type: z.literal("label"),
    imageEvidence: ImageBottleEvidenceSchema,
  }),
  z.object({
    type: z.literal("candidates"),
    bottles: z
      .array(BottleSchema)
      .max(PHOTO_IDENTIFICATION_MAX_PROGRESS_CANDIDATES),
  }),
  z.object({
    type: z.literal("step"),
    step: PhotoIdentificationStepEnum,
  }),
]);
