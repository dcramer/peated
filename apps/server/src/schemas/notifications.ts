import { z } from "zod";
import { UserSchema } from "./users";

export const NotificationTypeEnum = z.enum([
  "friend_request",
  "toast",
  "comment",
]);

export const NotificationSchema = z.object({
  id: z.number().describe("Unique identifier for the notification"),
  objectId: z.number().describe("ID of the object this notification refers to"),
  type: NotificationTypeEnum.describe("Type of notification"),
  fromUser: UserSchema.nullable().describe(
    "User who triggered this notification",
  ),
  createdAt: z
    .string()
    .datetime()
    .describe("Timestamp when the notification was created"),
  read: z.boolean().describe("Whether the notification has been read"),
  ref: z.any().nullable().describe("Reference object for the notification"),
  // TODO:
  // ref: z.union([TastingSchema, FriendSchema, z.null()]),
});

export const NotificationInputSchema = z.object({
  read: z.boolean().describe("Whether to mark the notification as read"),
});
