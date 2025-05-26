import { z } from "zod";
import { ObjectTypeEnum } from "./shared";
import { UserSchema } from "./users";

export const ChangeTypeEnum = z.enum(["add", "update", "delete"]);

export const ChangeSchema = z.object({
  id: z.number().describe("Unique identifier for the change"),
  objectId: z.number().describe("ID of the object that was changed"),
  objectType: ObjectTypeEnum.describe("Type of object that was changed"),
  displayName: z
    .string()
    .nullable()
    .describe("Display name of the changed object"),
  type: ChangeTypeEnum.describe("Type of change (add, update, delete)"),
  createdBy: UserSchema.nullable().describe("User who made the change"),
  createdAt: z
    .string()
    .datetime()
    .describe("Timestamp when the change was made"),
  data: z.record(z.any()).describe("Additional data about the change"),
});
