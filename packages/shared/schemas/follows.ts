import { z } from "zod";
import { FollowStatusEnum } from "./shared";
import { UserSchema } from "./users";

export const FollowSchema = z.object({
  id: z.number(),
  status: FollowStatusEnum,
  user: UserSchema,
  createdAt: z.string().datetime().optional(),
  followsBack: FollowStatusEnum,
});
