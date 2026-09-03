import { z } from "zod";

export const PointSchema = z
  .tuple([
    z.number().min(-180).max(180).describe("Longitude in decimal degrees"),
    z.number().min(-90).max(90).describe("Latitude in decimal degrees"),
  ])
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
    "bottle_group",
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
    .describe(
      "Next page number to pass as `cursor`, or `null` when there is no next page",
    ),
  prevCursor: z
    .number()
    .nullable()
    .describe(
      "Previous page number to pass as `cursor`, or `null` when there is no previous page",
    ),
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
