import { z } from "zod";
import { COUNTRY_LIST } from "../constants";

export const PointSchema = z.tuple([z.number(), z.number()]);

export const FollowStatusEnum = z.enum(["pending", "following", "none"]);

export const ObjectTypeEnum = z.enum([
  "follow",
  "toast",
  "comment",
  "bottle",
  "entity",
]);

export const PagingRelSchema = z.object({
  nextPage: z.number().nullable(),
  next: z.string().nullable(),

  prevPage: z.number().nullable(),
  prev: z.string().nullable(),
});

export const PaginatedSchema = z.object({
  results: z.array(z.any()),

  rel: PagingRelSchema.optional(),
});

export const CountryEnum = z.enum(COUNTRY_LIST);
