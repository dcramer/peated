import { z } from "zod";
import { UserSchema } from "./users";

export const AuthSchema = z.object({
  user: UserSchema,
  accessToken: z.string().optional(),
});
