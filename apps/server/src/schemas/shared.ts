import { z } from "zod";

export const PointSchema = z
  .tuple([z.number(), z.number()])
  .describe("Geographic coordinates as [longitude, latitude]");

export const FollowStatusEnum = z
  .enum(["pending", "following", "none"])
  .describe("Status of a follow relationship");

export const FriendStatusEnum = z
  .enum(["pending", "friends", "none"])
  .describe("Status of a friendship");

export const ObjectTypeEnum = z
  .enum([
    "follow",
    "toast",
    "comment",
    "bottle",
    "bottle_release",
    "bottle_series",
    "entity",
    "tasting",
  ])
  .describe("Type of object in the system");

export const CursorSchema = z.object({
  nextCursor: z
    .number()
    .nullable()
    .describe("Cursor for the next page of results"),
  prevCursor: z
    .number()
    .nullable()
    .describe("Cursor for the previous page of results"),
});
