import { z } from "zod";
import { FriendStatusEnum } from "./shared";

export const UserSchema = z.object({
  id: z.number(),
  username: z.string().toLowerCase().trim().min(1, "Required"),
  pictureUrl: z.string().nullable(),
  private: z.boolean(),

  email: z.string().email().optional(),
  verified: z.boolean().optional(),

  admin: z.boolean().optional(),
  mod: z.boolean().optional(),
  createdAt: z.string().datetime().optional(),
  friendStatus: FriendStatusEnum.optional(),
});

export const UserInputSchema = z.object({
  username: z.string().toLowerCase().trim().min(1, "Required"),
  password: z.string().trim().min(8, "At least 8 characters.").nullish(),
  private: z.boolean().optional(),
  admin: z.boolean().optional(),
  mod: z.boolean().optional(),
  notifyComments: z.boolean().optional(),
});
