import { z } from "zod";
import { RATING_BAND_IDS } from "../constants";
import { ServingStyleEnum } from "./common";

const RatingBandEnum = z.enum(RATING_BAND_IDS);

export const AdminContentKindSchema = z.enum([
  "member_review",
  "external_review",
  "tasting",
]);

export const AdminContentStatusSchema = z.enum(["active", "removed", "all"]);

export type AdminContentKind = z.infer<typeof AdminContentKindSchema>;
export type AdminContentStatus = z.infer<typeof AdminContentStatusSchema>;

const AdminContentBottleSchema = z.object({
  id: z.number().int().positive(),
  fullName: z.string(),
});

const AdminContentMemberSchema = z.object({
  id: z.number().int().positive(),
  username: z.string(),
  private: z.boolean(),
});

const AdminContentActorSchema = z.object({
  id: z.number().int().positive(),
  displayName: z.string(),
});

const AdminContentModerationSchema = z.object({
  removed: z.boolean(),
  removedAt: z.string().datetime().nullable(),
  removedBy: AdminContentActorSchema.nullable(),
  reason: z.string().nullable(),
});

const AdminContentHistorySchema = z.array(
  z.object({
    id: z.number().int().positive(),
    action: z.enum(["remove", "restore"]),
    reason: z.string(),
    createdAt: z.string().datetime(),
    actor: AdminContentActorSchema,
  }),
);

const AdminMemberReviewSchema = z.object({
  kind: z.literal("member_review"),
  id: z.number().int().positive(),
  bottle: AdminContentBottleSchema,
  member: AdminContentMemberSchema,
  score: z.number().int().min(0).max(100),
  notes: z.string().nullable(),
  tags: z.array(z.string()),
  noseTags: z.array(z.string()),
  palateTags: z.array(z.string()),
  finishTags: z.array(z.string()),
  color: z.number().int().nullable(),
  servingStyle: ServingStyleEnum.nullable(),
  imageUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  moderation: AdminContentModerationSchema,
  history: AdminContentHistorySchema,
});

const AdminExternalReviewSchema = z.object({
  kind: z.literal("external_review"),
  id: z.number().int().positive(),
  name: z.string(),
  bottle: AdminContentBottleSchema.nullable(),
  site: z.object({
    id: z.number().int().positive(),
    name: z.string(),
    key: z.string(),
  }),
  article: z.object({
    title: z.string().nullable(),
    url: z.string(),
    publishedAt: z.string().datetime().nullable(),
  }),
  reviewerName: z.string().nullable(),
  nativeScoreDisplay: z.string().nullable(),
  clip: z.string().nullable(),
  tags: z.array(z.string()),
  hidden: z.boolean(),
  publicationApproved: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  moderation: AdminContentModerationSchema,
  history: AdminContentHistorySchema,
});

const AdminTastingSchema = z.object({
  kind: z.literal("tasting"),
  id: z.number().int().positive(),
  bottle: AdminContentBottleSchema,
  member: AdminContentMemberSchema,
  ratingBand: RatingBandEnum.nullable(),
  notes: z.string().nullable(),
  tags: z.array(z.string()),
  color: z.number().int().nullable(),
  servingStyle: ServingStyleEnum.nullable(),
  imageUrl: z.string().nullable(),
  comments: z.number().int().nonnegative(),
  toasts: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  moderation: AdminContentModerationSchema,
  history: AdminContentHistorySchema,
});

export const AdminContentItemSchema = z.discriminatedUnion("kind", [
  AdminMemberReviewSchema,
  AdminExternalReviewSchema,
  AdminTastingSchema,
]);

export const AdminContentListItemSchema = z.discriminatedUnion("kind", [
  AdminMemberReviewSchema.omit({ history: true }),
  AdminExternalReviewSchema.omit({ history: true }),
  AdminTastingSchema.omit({ history: true }),
]);

export type AdminContentItem = z.infer<typeof AdminContentItemSchema>;
export type AdminContentListItem = z.infer<typeof AdminContentListItemSchema>;

export const AdminContentModerationInputSchema = z
  .object({
    kind: AdminContentKindSchema,
    id: z.coerce.number().int().positive(),
    removed: z.boolean(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
