import { z } from "zod";
import { UserSchema } from "./users";

export const AuthSchema = z.object({
  user: UserSchema,
  accessToken: z.string().optional(),
});

export const EmailVerifySchema = z.object({
  id: z.number(),
  email: z.string(),
});
