import {
  BottleCandidateSchema,
  ImageBottleEvidenceSchema,
} from "@peated/bottle-classifier/contract";
import { z } from "zod";
import { SIMPLE_RATING_VALUES } from "../constants";
import { BadgeAwardSchema } from "./badges";
import { BottleReleaseSchema } from "./bottleReleases";
import { BottleSchema } from "./bottles";
import { ServingStyleEnum, zDatetime } from "./common";
import { PendingUploadSchema } from "./pendingUploads";
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

export const PhotoIdentificationSuggestedNextStepEnum = z.enum([
  "confirm_match",
  "confirm_create",
  "manual_search",
  "needs_review",
]);

export const PhotoIdentificationInputSchema = z.object({
  file: z.instanceof(Blob).describe("Bottle label image to identify"),
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
  bottleId: true,
  releaseId: true,
  bottleFullName: true,
  fullName: true,
});

const PhotoIdentificationProposedBottleSchema = z.object({
  name: z.string().trim().min(1),
  brand: z.object({
    name: z.string().trim().min(1),
  }),
});

const PhotoIdentificationProposedReleaseSchema = z.object({
  edition: z.string().nullable(),
});

export const PhotoIdentificationDecisionSchema = z.discriminatedUnion(
  "action",
  [
    z.object({
      action: z.literal("match"),
      matchedBottleId: z.number().int(),
      matchedReleaseId: z.number().int().nullable(),
    }),
    z.object({
      action: z.literal("create_bottle"),
      proposedBottle: PhotoIdentificationProposedBottleSchema,
    }),
    z.object({
      action: z.literal("create_release"),
      parentBottleId: z.number().int(),
      proposedRelease: PhotoIdentificationProposedReleaseSchema,
    }),
    z.object({
      action: z.literal("create_bottle_and_release"),
      proposedBottle: PhotoIdentificationProposedBottleSchema,
      proposedRelease: PhotoIdentificationProposedReleaseSchema,
    }),
    z.object({
      action: z.literal("repair_parent_and_create_release"),
    }),
    z.object({
      action: z.literal("repair_bottle"),
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
});
