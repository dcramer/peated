import { z } from "zod";
import { FriendStatusEnum } from "./shared";

export const UserSchema = z.object({
  id: z.number(),
  username: z.string().toLowerCase().trim().min(1, "Required"),
  pictureUrl: z.string().nullable(),
  private: z.boolean(),

  email: z.string().email().optional(),
  admin: z.boolean().optional(),
  mod: z.boolean().optional(),
  createdAt: z.string().datetime().optional(),
  friendStatus: FriendStatusEnum.optional(),
});

export const UserInputSchema = z.object({
  username: z.string().toLowerCase().trim().min(1, "Required"),
  private: z.boolean().optional(),
  admin: z.boolean().optional(),
  mod: z.boolean().optional(),
  notifyComments: z.boolean().optional(),
});
