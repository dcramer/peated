import { z } from "zod";
import { BottleSchema } from "./bottles";
import { FriendStatusEnum } from "./shared";
import { UserSchema } from "./users";

const NotificationBaseSchema = z.object({
  id: z.number().describe("Unique identifier for the notification"),
  objectId: z.number().describe("ID of the object this notification refers to"),
  fromUser: UserSchema.nullable().describe(
    "User who triggered this notification",
  ),
  createdAt: z
    .string()
    .datetime()
    .describe("Timestamp when the notification was created"),
  read: z.boolean().describe("Whether the notification has been read"),
});

const TastingNotificationRefSchema = z.object({
  id: z.number().int().positive().describe("Referenced tasting ID"),
  bottle: BottleSchema,
});

const FriendRequestNotificationRefSchema = z.object({
  status: FriendStatusEnum,
  userId: z.number().int().positive().describe("User who sent the request"),
});

export const NotificationSchema = z.discriminatedUnion("type", [
  NotificationBaseSchema.extend({
    type: z.literal("friend_request").describe("Type of notification"),
    ref: FriendRequestNotificationRefSchema.nullable().describe(
      "Friend request referenced by this notification",
    ),
  }),
  NotificationBaseSchema.extend({
    type: z.literal("toast").describe("Type of notification"),
    ref: TastingNotificationRefSchema.nullable().describe(
      "Tasting referenced by this toast notification",
    ),
  }),
  NotificationBaseSchema.extend({
    type: z.literal("comment").describe("Type of notification"),
    ref: TastingNotificationRefSchema.nullable().describe(
      "Tasting referenced by this comment notification",
    ),
  }),
]);

export const NotificationInputSchema = z.object({
  read: z.boolean().describe("Whether to mark the notification as read"),
});
