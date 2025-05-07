import { z } from "zod";
import { zDatetime } from "./common";
import { UserSchema } from "./users";

export const CommentSchema = z.object({
  id: z.number(),
  comment: z.string(),
  createdAt: z.string().datetime(),
  createdBy: UserSchema,
  replyToId: z.number().nullable().optional(),
  mentionedUsernames: z.array(z.string()).optional(),
  deleted: z.boolean().optional(),
});

export const CommentInputSchema = z.object({
  comment: z.string().trim().min(1, "Required"),
  createdAt: zDatetime,
  replyToId: z.number().nullable().optional(),
  mentionedUsernames: z.array(z.string()).optional(),
});
