import { z } from "zod";
import { zDatetime } from "./common";
import { UserSchema } from "./users";

// Maximum number of mentions allowed in a single comment
const MAX_MENTIONS = 20;

// Maximum length for comment text
const MAX_COMMENT_LENGTH = 2000;

export const CommentSchema = z.object({
  id: z.number(),
  comment: z
    .string()
    .max(
      MAX_COMMENT_LENGTH,
      `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`,
    ),
  createdAt: z.string().datetime(),
  createdBy: UserSchema,
  replyToId: z.number().nullable().optional(),
  mentionedUsernames: z
    .array(z.string())
    .max(MAX_MENTIONS, `Maximum of ${MAX_MENTIONS} mentions allowed`)
    .optional(),
});

export const CommentInputSchema = z.object({
  comment: z
    .string()
    .trim()
    .min(1, "Required")
    .max(
      MAX_COMMENT_LENGTH,
      `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`,
    ),
  createdAt: zDatetime,
  replyToId: z.number().nullable().optional(),
  mentionedUsernames: z
    .array(z.string())
    .max(MAX_MENTIONS, `Maximum of ${MAX_MENTIONS} mentions allowed`)
    .optional(),
});
