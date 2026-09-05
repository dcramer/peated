import { z } from "zod";

export const BottleReferenceDetailsSchema = z.object({
  id: z.number(),
  name: z.string(),
  createdAt: z.string(),
  bottleId: z.number().nullable(),
  ignored: z.boolean(),
  assignmentSource: z.string(),
  assignedByActorId: z.number(),
});
