import { z } from "zod";
import { CollectionBottleSchema, CollectionSchema } from "./collections";
import { TastingSchema } from "./tastings";
import { UserSchema } from "./users";

export const ActivityTastingSessionEntrySchema = z.object({
  id: z.string().describe("Stable activity entry identifier"),
  type: z.literal("tasting_session"),
  priority: z.literal("primary"),
  startedAt: z
    .string()
    .datetime()
    .readonly()
    .describe("Timestamp of the first tasting in this session"),
  lastActivityAt: z
    .string()
    .datetime()
    .readonly()
    .describe("Timestamp of the latest tasting in this session"),
  createdBy: UserSchema.readonly().describe(
    "User who created the tastings in this session",
  ),
  tastings: z
    .array(TastingSchema)
    .min(1)
    .describe("Tastings represented by this activity session"),
});

export const ActivityCollectionSchema = CollectionSchema.extend({
  href: z
    .string()
    .nullable()
    .describe("Activity collection route when the destination is linkable"),
});

export const ActivityCollectionAddEntrySchema = z.object({
  id: z.string().describe("Stable activity entry identifier"),
  type: z.literal("collection_add"),
  priority: z.literal("secondary"),
  createdAt: z
    .string()
    .datetime()
    .readonly()
    .describe("Timestamp used to order this activity entry"),
  windowStart: z
    .string()
    .datetime()
    .readonly()
    .describe("Earliest collection addition represented by this entry"),
  windowEnd: z
    .string()
    .datetime()
    .readonly()
    .describe("Latest collection addition represented by this entry"),
  createdBy: UserSchema.readonly().describe("User who added the items"),
  collection: ActivityCollectionSchema.describe(
    "Destination collection for the grouped additions",
  ),
  items: z
    .array(CollectionBottleSchema)
    .describe("Preview collection items represented by this entry"),
  totalItems: z
    .number()
    .int()
    .gte(1)
    .describe("Total collection items represented by this entry"),
});

export const ActivityEntrySchema = z.discriminatedUnion("type", [
  ActivityTastingSessionEntrySchema,
  ActivityCollectionAddEntrySchema,
]);

export const ActivityCursorSchema = z.object({
  nextCursor: z
    .string()
    .nullable()
    .describe("Opaque cursor for the next page of activity"),
  prevCursor: z
    .string()
    .nullable()
    .describe("Opaque cursor for the previous page of activity"),
});

export const ActivityListResponseSchema = z.object({
  results: z.array(ActivityEntrySchema),
  rel: ActivityCursorSchema,
});

export const ProfileTastingSessionActivitySchema =
  ActivityTastingSessionEntrySchema;
export const ProfileCollectionActivityCollectionSchema =
  ActivityCollectionSchema;
export const ProfileCollectionAddActivitySchema =
  ActivityCollectionAddEntrySchema;
export const ProfileActivityEntrySchema = ActivityEntrySchema;
