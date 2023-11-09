import { z } from "zod";
import { ObjectTypeEnum } from "./shared";
import { UserSchema } from "./users";

export const ChangeTypeEnum = z.enum(["add", "update", "delete"]);

export const ChangeSchema = z.object({
  id: z.number(),
  objectId: z.number(),
  objectType: ObjectTypeEnum,
  displayName: z.string().nullable(),
  type: ChangeTypeEnum,
  createdBy: UserSchema.nullable(),
  createdAt: z.string().datetime(),
  data: z.record(z.any()),
});
