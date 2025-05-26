import { z } from "zod";
import { FollowStatusEnum } from "./shared";
import { UserSchema } from "./users";

export const FollowSchema = z.object({
  id: z.number().describe("Unique identifier for the follow relationship"),
  status: FollowStatusEnum.describe("Status of the follow relationship"),
  user: UserSchema.describe("The user being followed"),
  createdAt: z
    .string()
    .datetime()
    .optional()
    .describe("Timestamp when the follow was created"),
  followsBack: FollowStatusEnum.describe(
    "Whether the followed user follows back",
  ),
});
