import { z } from "zod";

export const EventSchema = z.object({
  id: z.number(),
  name: z.string().trim().min(1, "Required"),
  dateStart: z.string().date(),
  dateEnd: z.string().date().nullable().default(null),
  repeats: z.boolean().default(false),
  website: z.string().url().nullable().default(null),
  description: z.string().nullable().default(null),
});

export const EventInputSchema = EventSchema.omit({ id: true });
