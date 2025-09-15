import { z } from "zod";
import { FriendStatusEnum } from "./shared";

export const UserSchema = z.object({
  id: z.number().readonly().describe("Unique identifier for the user"),
  username: z
    .string()
    .toLowerCase()
    .trim()
    .min(1, "Required")
    .describe("Unique username for the user"),
  pictureUrl: z
    .string()
    .nullable()
    .default(null)
    .readonly()
    .describe("URL to the user's profile picture"),
  private: z
    .boolean()
    .default(false)
    .describe("Whether the user's profile is private"),

  email: z.string().email().optional().describe("User's email address"),
  verified: z
    .boolean()
    .optional()
    .readonly()
    .describe("Whether the user's email is verified"),

  admin: z
    .boolean()
    .optional()
    .describe("Whether the user has admin privileges"),
  mod: z
    .boolean()
    .optional()
    .describe("Whether the user has moderator privileges"),

  createdAt: z
    .string()
    .datetime()
    .optional()
    .readonly()
    .describe("Timestamp when the user account was created"),
  tosAcceptedAt: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .readonly()
    .describe("Timestamp when the user accepted the Terms of Service"),
  friendStatus: FriendStatusEnum.optional()
    .readonly()
    .describe("Friendship status with the current user"),
});

export const UserInputSchema = UserSchema.omit({
  id: true,
  verified: true,
  createdAt: true,
  friendStatus: true,
}).extend({
  password: z
    .string()
    .trim()
    .min(8, "At least 8 characters.")
    .nullish()
    .describe("User's password (minimum 8 characters)"),
  picture: z.null().optional().describe("Optional profile picture upload"),
  notifyComments: z
    .boolean()
    .optional()
    .describe("Whether to notify user of comments on their content"),
});
