import { z } from "zod";
import { FollowSchema } from "./follows";
import { ObjectTypeEnum } from "./shared";
import { TastingSchema } from "./tastings";
import { UserSchema } from "./users";

export const NotificationSchema = z.object({
  id: z.number(),
  objectId: z.number(),
  objectType: ObjectTypeEnum,
  fromUser: UserSchema.optional(),
  createdAt: z.string().datetime(),
  read: z.boolean(),
  ref: z.union([TastingSchema, FollowSchema, z.null()]),
});
