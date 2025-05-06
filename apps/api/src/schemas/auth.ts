import { z } from "zod";
import "zod-openapi/extend";
import { UserSchema } from "./users";

export const AuthSchema = z.object({
  user: UserSchema,
  accessToken: z.string().optional(),
});

export const BasicAuthSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const GoogleAuthSchema = z.object({
  googleCode: z.string(),
});

export const EmailVerifySchema = z.object({
  id: z.number(),
  email: z.string(),
});

export const PasswordResetSchema = z.object({
  id: z.number(),
  email: z.string(),
  createdAt: z.string().datetime(),
  digest: z.string(),
});
