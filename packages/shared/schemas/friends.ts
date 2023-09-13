import { z } from "zod";
import { FriendStatusEnum } from "./shared";
import { UserSchema } from "./users";

export const FriendSchema = z.object({
  id: z.string(),
  status: FriendStatusEnum,
  user: UserSchema,
  createdAt: z.string().datetime().optional(),
});
