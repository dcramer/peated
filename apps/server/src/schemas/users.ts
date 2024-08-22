import { z } from "zod";
import { FriendStatusEnum } from "./shared";

export const UserSchema = z.object({
  id: z.number().readonly(),
  username: z.string().toLowerCase().trim().min(1, "Required"),
  pictureUrl: z.string().nullable().default(null).readonly(),
  private: z.boolean().default(false),

  email: z.string().email().optional(),
  verified: z.boolean().optional().readonly(),

  admin: z.boolean().optional(),
  mod: z.boolean().optional(),

  createdAt: z.string().datetime().optional().readonly(),
  friendStatus: FriendStatusEnum.optional().readonly(),
});

export const UserInputSchema = UserSchema.omit({
  id: true,
  verified: true,
  createdAt: true,
  friendStatus: true,
}).extend({
  password: z.string().trim().min(8, "At least 8 characters.").nullish(),
  picture: z.null().optional(),
  notifyComments: z.boolean().optional(),
});
