import { z } from "zod";
import { COUNTRY_LIST } from "../constants";

export const PointSchema = z.tuple([z.number(), z.number()]);

export const FollowStatusEnum = z.enum(["pending", "following", "none"]);

export const FriendStatusEnum = z.enum(["pending", "friends", "none"]);

export const ObjectTypeEnum = z.enum([
  "follow",
  "toast",
  "comment",
  "bottle",
  "entity",
  "tasting",
]);

export const CountryEnum = z.enum(COUNTRY_LIST);
