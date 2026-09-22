import { z } from "zod";
import { UserSchema } from "./users";

export const UserBlockSchema = z.object({
  user: UserSchema.describe("The blocked member."),
  createdAt: z.string().datetime(),
});
