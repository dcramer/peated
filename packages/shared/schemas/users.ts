import { z } from "zod";
import { FollowStatusEnum } from "./shared";

export const UserSchema = z.object({
  id: z.number(),
  displayName: z.string().trim().min(1, "Required"),
  username: z.string().trim().min(1, "Required"),
  pictureUrl: z.string(),
  private: z.boolean(),

  email: z.string().email().optional(),
  admin: z.boolean().optional(),
  mod: z.boolean().optional(),
  createdAt: z.string().datetime().optional(),
  followStatus: FollowStatusEnum.optional(),
});

export const UserInputSchema = z.object({
  displayName: z.string().trim().min(1, "Required"),
  username: z.string().trim().min(1, "Required"),
  private: z.boolean().optional(),
  admin: z.boolean().optional(),
  mod: z.boolean().optional(),
});
