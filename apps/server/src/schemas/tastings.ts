import { JSON_SCHEMA_INPUT_REGISTRY } from "@orpc/zod/zod4";
import {
  BottleCandidateSchema,
  ImageBottleEvidenceSchema,
} from "@peated/bottle-classifier/contract";
import { z } from "zod";
import { SIMPLE_RATING_VALUES } from "../constants";
import { BadgeAwardSchema } from "./badges";
import { BottleSchema } from "./bottles";
import { CategoryEnum, ServingStyleEnum, zDatetime } from "./common";
import { PendingUploadSchema } from "./pendingUploads";
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
  .describe("Simple rating: -1 (Pass), 1 (Sip), 2 (Savor)");
const TastingScoreSchema = z
  .number()
  .int()
  .min(0)
  .max(100)
  .nullable()
  .default(null)
  .describe("Advanced whole-number whisky score from 0 through 100");
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
  .describe("Optional image upload for the tasting");

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
  rating: TastingRatingSchema,
  score: TastingScoreSchema,
  tags: TastingTagsSchema,
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

  createdAt: z
    .string()
    .datetime()
    .readonly()
    .describe("Timestamp when the tasting was created"),
  createdBy: UserSchema.readonly().describe("User who created this tasting"),
});

export const TastingContentInputSchema = TastingSchema.omit({
  id: true,
  bottle: true,
  awards: true,
  comments: true,
  toasts: true,
  hasToasted: true,
  createdBy: true,
}).extend({
  flight: z
    .string()
    .nullish()
    .describe("Flight ID if this tasting is part of a flight"),
  createdAt: zDatetime
    .nullish()
    .describe("Custom creation timestamp for the tasting"),
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
})
  .strict()
  .refine((data) => data.rating === null || data.score === null, {
    message: "Cannot provide both a simple rating and an advanced score",
    path: ["score"],
  });

export const TastingUpdateFields = {
  notes: TastingNotesSchema.removeDefault().optional(),
  rating: TastingRatingSchema.removeDefault().optional(),
  score: TastingScoreSchema.removeDefault().optional(),
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

const PhotoIdentificationProposedBottleSchema = z.object({
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

export const PhotoIdentificationSchema = z.object({
  pendingImage: PendingUploadSchema.pick({
    id: true,
    imageUrl: true,
    expiresAt: true,
  }),
  imageEvidence: ImageBottleEvidenceSchema,
  classification: PhotoIdentificationClassificationSchema,
  suggestedNextStep: PhotoIdentificationSuggestedNextStepEnum,
  diagnostics: PhotoIdentificationDiagnosticsSchema,
  createToken: z
    .string()
    .nullable()
    .describe("Signed token for creating an auto-approved photo proposal"),
});
