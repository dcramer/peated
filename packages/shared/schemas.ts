import { z } from "zod";

export const NewTasting = z.object({
  bottle: z.number(),
  notes: z.string().optional(),
  rating: z.number().gte(0).lte(5).optional(),
  tags: z.array(z.string()).optional(),
  edition: z.string().optional(),
  vintageYear: z.number().gte(1495).lte(new Date().getFullYear()).optional(),
  barrel: z.number().optional(),
});
