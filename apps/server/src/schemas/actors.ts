import { z } from "zod";
import { UserSchema } from "./users";

export const ActorTypeEnum = z.enum(["system", "user"]);

export const ActorSchema = z.object({
  id: z.number().readonly().describe("Unique identifier for the actor"),
  type: ActorTypeEnum.describe("Type of actor"),
  key: z.string().describe("Stable actor key"),
  displayName: z.string().describe("Human-readable actor name"),
  pictureUrl: z
    .string()
    .nullable()
    .describe("URL to the actor's profile picture"),
  user: UserSchema.nullable().describe("Linked user for user actors"),
});
