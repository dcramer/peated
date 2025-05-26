import { z } from "zod";
import { zDatetime } from "./common";
import { UserSchema } from "./users";

export const CommentSchema = z.object({
  id: z.number().describe("Unique identifier for the comment"),
  comment: z.string().describe("Content of the comment"),
  createdAt: z
    .string()
    .datetime()
    .describe("Timestamp when the comment was created"),
  createdBy: UserSchema.describe("User who created this comment"),
});

export const CommentInputSchema = z.object({
  comment: z
    .string()
    .trim()
    .min(1, "Required")
    .describe("Content of the comment"),
  createdAt: zDatetime.describe("Timestamp when the comment was created"),
});
