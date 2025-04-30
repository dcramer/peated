import { z } from "zod";
import { UserSchema } from "./users";

export const NotificationTypeEnum = z.enum([
  "friend_request",
  "toast",
  "comment",
]);

export const NotificationSchema = z.object({
  id: z.number(),
  objectId: z.number(),
  type: NotificationTypeEnum,
  fromUser: UserSchema.nullable(),
  createdAt: z.string().datetime(),
  read: z.boolean(),
  ref: z.any().nullable(),
  // ref: z.union([TastingSchema, FriendSchema, z.null()]),
});

export const NotificationInputSchema = z.object({
  read: z.boolean(),
});
