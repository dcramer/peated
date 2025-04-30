import { z } from "zod";
import { zDatetime } from "./common";
import { UserSchema } from "./users";

export const CommentSchema = z.object({
  id: z.number(),
  comment: z.string(),
  createdAt: z.string().datetime(),
  createdBy: UserSchema,
});

export const CommentInputSchema = z.object({
  comment: z.string().trim().min(1, "Required"),
  createdAt: zDatetime,
});
