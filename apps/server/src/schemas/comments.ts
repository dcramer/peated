import { z } from "zod";
import { zDatetime } from "./common";
import { UserSchema } from "./users";

// Maximum number of mentions allowed in a single comment
const MAX_MENTIONS = 20;

export const CommentSchema = z.object({
  id: z.number(),
  comment: z.string(),
  createdAt: z.string().datetime(),
  createdBy: UserSchema,
  replyToId: z.number().nullable().optional(),
  mentionedUsernames: z
    .array(z.string())
    .max(MAX_MENTIONS, `Maximum of ${MAX_MENTIONS} mentions allowed`)
    .optional(),
});

export const CommentInputSchema = z.object({
  comment: z.string().trim().min(1, "Required"),
  createdAt: zDatetime,
  replyToId: z.number().nullable().optional(),
  mentionedUsernames: z
    .array(z.string())
    .max(MAX_MENTIONS, `Maximum of ${MAX_MENTIONS} mentions allowed`)
    .optional(),
});
