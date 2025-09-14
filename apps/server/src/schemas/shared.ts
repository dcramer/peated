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

// Generic HTTP response helpers shared across endpoints
// TODO(response-envelope): During the coordinated response migration,
// change listResponse from { results, rel } to:
//   { data: T[], meta: { cursor: Cursor } }
// and update all callers in one pass.
export const listResponse = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    results: z.array(item),
    rel: CursorSchema,
  });

// TODO(response-envelope): During the coordinated response migration,
// change detailsResponse (identity) to wrap in:
//   z.object({ data: schema })
// and update all callers in one pass.
export const detailsResponse = <T extends z.ZodTypeAny>(schema: T) => schema;
