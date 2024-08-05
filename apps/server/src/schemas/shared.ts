import { z } from "zod";

export const PointSchema = z.tuple([z.number(), z.number()]);

export const FollowStatusEnum = z.enum(["pending", "following", "none"]);

export const FriendStatusEnum = z.enum(["pending", "friends", "none"]);

export const ObjectTypeEnum = z.enum([
  "follow",
  "toast",
  "comment",
  "bottle",
  "bottle_edition",
  "entity",
  "tasting",
]);
