import { z } from "zod";

export const UnauthorizedErrorSchema = z.object({
  statusCode: z.literal(401),
  error: z.literal("Unauthorized"),
  message: z.string(),
  code: z.string().optional(),
});

export const ConflictErrorSchema = z.object({
  statusCode: z.literal(409),
  error: z.literal("Conflict"),
  message: z.string(),
  code: z.string().optional(),
});
