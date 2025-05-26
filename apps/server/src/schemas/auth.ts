import { z } from "zod";
import { UserSchema } from "./users";

export const AuthSchema = z.object({
  user: UserSchema.describe("Authenticated user information"),
  accessToken: z
    .string()
    .optional()
    .describe("JWT access token for authentication"),
});

export const EmailVerifySchema = z.object({
  id: z.number().describe("Unique identifier for the email verification"),
  email: z.string().describe("Email address to verify"),
});

export const PasswordResetSchema = z.object({
  id: z.number().describe("Unique identifier for the password reset request"),
  email: z.string().describe("Email address for password reset"),
  createdAt: z
    .string()
    .datetime()
    .describe("Timestamp when the reset request was created"),
  digest: z.string().describe("Secure digest for password reset verification"),
});
