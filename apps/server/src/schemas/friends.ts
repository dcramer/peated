import { z } from "zod";
import { FriendStatusEnum } from "./shared";
import { UserSchema } from "./users";

export const FriendSchema = z.object({
  id: z.number().describe("Unique identifier for the friendship"),
  status: FriendStatusEnum.describe(
    "Status of the friendship (pending, accepted, etc.)",
  ),
  user: UserSchema.describe("The friend user"),
  createdAt: z
    .string()
    .datetime()
    .optional()
    .describe("Timestamp when the friendship was created"),
});
