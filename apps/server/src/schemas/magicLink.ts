import { z } from "zod";
import { zDatetime } from "./common";

export const MagicLinkSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  createdAt: zDatetime,
});

export type MagicLink = z.infer<typeof MagicLinkSchema>;
