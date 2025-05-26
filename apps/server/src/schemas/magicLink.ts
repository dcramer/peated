import { z } from "zod";
import { zDatetime } from "./common";

export const MagicLinkSchema = z.object({
  id: z.number().describe("Unique identifier for the magic link"),
  email: z.string().email().describe("Email address for the magic link"),
  createdAt: zDatetime.describe("Timestamp when the magic link was created"),
});

export type MagicLink = z.infer<typeof MagicLinkSchema>;
