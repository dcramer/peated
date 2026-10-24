import { ENTITY_EVENT_KIND_LIST } from "@peated/server/constants";
import { z } from "zod";

export const EntityEventKindEnum = z.enum(ENTITY_EVENT_KIND_LIST);

export const EntityEventDateSchema = z
  .string()
  .regex(/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/, "Use YYYY, YYYY-MM, or YYYY-MM-DD.")
  .superRefine((value, context) => {
    const completeDate =
      value.length === 4
        ? `${value}-01-01`
        : value.length === 7
          ? `${value}-01`
          : value;
    if (!z.string().date().safeParse(completeDate).success) {
      context.addIssue({
        code: "custom",
        message: "Invalid date.",
      });
    }
  });

export const EntityEventInputFields = {
  kind: EntityEventKindEnum,
  date: EntityEventDateSchema,
  description: z.string().trim().min(1).nullable().optional(),
  newOwnerId: z.number().int().positive().nullable().optional(),
  sourceUrl: z.string().url().nullable().optional(),
} as const;

export const EntityEventInputSchema = z
  .object(EntityEventInputFields)
  .superRefine((event, context) => {
    if (event.kind === "generic" && !event.description) {
      context.addIssue({
        code: "custom",
        path: ["description"],
        message: "A description is required when kind is generic.",
      });
    }
    if (event.kind === "acquired" && !event.newOwnerId) {
      context.addIssue({
        code: "custom",
        path: ["newOwnerId"],
        message: "A new owner is required when kind is acquired.",
      });
    }
    if (event.kind !== "acquired" && event.newOwnerId) {
      context.addIssue({
        code: "custom",
        path: ["newOwnerId"],
        message: "New owner can only be set when kind is acquired.",
      });
    }
  });

export const EntityEventSchema = z.object({
  id: z.number(),
  entityId: z.number(),
  kind: EntityEventKindEnum,
  date: EntityEventDateSchema,
  description: z.string().nullable(),
  newOwnerId: z.number().nullable(),
  sourceUrl: z.string().url().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
