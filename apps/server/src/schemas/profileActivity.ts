import { z } from "zod";
import { CollectionBottleSchema, CollectionSchema } from "./collections";
import { TastingSchema } from "./tastings";
import { UserSchema } from "./users";

export const ActivityTastingEntrySchema = z.object({
  id: z.string().describe("Stable activity entry identifier"),
  type: z.literal("tasting"),
  priority: z.literal("primary"),
  createdAt: z
    .string()
    .datetime()
    .readonly()
    .describe("Timestamp used to order this activity entry"),
  tasting: TastingSchema.describe("Tasting represented by this activity entry"),
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
  ActivityTastingEntrySchema,
  ActivityCollectionAddEntrySchema,
]);

export const ProfileTastingActivitySchema = ActivityTastingEntrySchema;
export const ProfileCollectionActivityCollectionSchema =
  ActivityCollectionSchema;
export const ProfileCollectionAddActivitySchema =
  ActivityCollectionAddEntrySchema;
export const ProfileActivityEntrySchema = ActivityEntrySchema;
