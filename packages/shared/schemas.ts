import { z } from "zod";

import {
  CATEGORY_LIST,
  COUNTRY_LIST,
  ENTITY_TYPE_LIST,
  SERVING_STYLE_LIST,
  STORE_TYPE_LIST,
} from "./constants";

export const PointSchema = z.tuple([z.number(), z.number()]);

export const FollowStatusEnum = z.enum(["pending", "following", "none"]);

export const UserSchema = z.object({
  id: z.number(),
  displayName: z.string().trim().min(1, "Required"),
  username: z.string().trim().min(1, "Required"),
  pictureUrl: z.string(),
  private: z.boolean(),

  email: z.string().email().optional(),
  admin: z.boolean().optional(),
  mod: z.boolean().optional(),
  createdAt: z.string().datetime().optional(),
  followStatus: FollowStatusEnum.optional(),
});

export const UserInputSchema = z.object({
  displayName: z.string().trim().min(1, "Required"),
  username: z.string().trim().min(1, "Required"),
  private: z.boolean().optional(),
  admin: z.boolean().optional(),
  mod: z.boolean().optional(),
});

export const EntityTypeEnum = z.enum(ENTITY_TYPE_LIST);

export const EntityInputSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  country: z.string().trim().nullable().optional(),
  region: z.string().trim().nullable().optional(),
  type: z.array(EntityTypeEnum).optional(),
  location: PointSchema.nullable().optional(),
});

export const EntitySchema = z.object({
  id: z.number(),
  name: z.string().trim().min(1, "Required"),
  country: z.string().trim().nullable(),
  region: z.string().trim().nullable(),
  type: z.array(EntityTypeEnum),
  location: PointSchema.nullable(),

  totalTastings: z.number(),
  totalBottles: z.number(),

  createdAt: z.string().datetime().optional(),
  createdBy: UserSchema.optional(),
});

export const CategoryEnum = z.enum(CATEGORY_LIST);

export const BottleSchema = z.object({
  id: z.number(),
  name: z.string().trim().min(1, "Required"),
  fullName: z.string(),
  brand: EntitySchema,
  distillers: z.array(EntitySchema),
  bottler: EntitySchema.nullable(),
  statedAge: z.number().nullable(),
  category: CategoryEnum.nullable(),

  createdAt: z.string().datetime().optional(),
  createdBy: UserSchema.optional(),
});

export const BottleInputSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  brand: z.union([EntityInputSchema, z.number()]),
  distillers: z.array(z.union([EntityInputSchema, z.number()])).optional(),
  bottler: z.union([EntityInputSchema, z.number()]).nullable().optional(),
  statedAge: z.number().nullable().optional(),
  category: CategoryEnum.nullable().optional(),
});

export const ServiceStyleEnum = z.enum(SERVING_STYLE_LIST);

export const TastingSchema = z.object({
  id: z.number(),
  imageUrl: z.string().nullable(),
  notes: z.string().nullable(),
  bottle: BottleSchema,
  rating: z.number().gte(0).lte(5).nullable(),
  tags: z.array(z.string()),
  servingStyle: ServiceStyleEnum.nullable(),

  comments: z.number().gte(0),
  toasts: z.number().gte(0),
  hasToasted: z.boolean().optional(),
  createdAt: z.string().datetime(),
  createdBy: UserSchema,
});

export const TastingInputSchema = z.object({
  bottle: z.number(),
  notes: z.string().nullable().optional(),
  rating: z.number().gte(0).lte(5).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  servingStyle: ServiceStyleEnum.nullable().optional(),

  createdAt: z.string().datetime().optional(),
});

export const CommentSchema = z.object({
  id: z.number(),
  comment: z.string().min(1, "Required"),
  createdAt: z.string().datetime().optional(),
  createdBy: UserSchema,
});

export const CommentInputSchema = z.object({
  comment: z.string().trim().min(1, "Required"),
  createdAt: z.string().datetime(),
});

export const CollectionSchema = z.object({
  id: z.number(),
  name: z.string().trim().min(1, "Required"),
  totalBottles: z.number(),
  createdAt: z.string().datetime().optional(),
  createdBy: UserSchema.optional(),
});

export const CollectionInputSchema = z.object({
  name: z.string(),
});

export const CollectionBottleSchema = z.object({
  bottle: BottleSchema,
});

export const CollectionBottleInputSchema = z.object({
  bottle: z.number(),
});

export const FollowSchema = z.object({
  id: z.number(),
  status: FollowStatusEnum,
  user: UserSchema,
  createdAt: z.string().datetime().optional(),
  followsBack: FollowStatusEnum,
});

export const ObjectTypeEnum = z.enum([
  "follow",
  "toast",
  "comment",
  "bottle",
  "entity",
]);

export const ChangeTypeEnum = z.enum(["add", "update", "delete"]);

export const ChangeSchema = z.object({
  id: z.number(),
  objectId: z.number(),
  objectType: ObjectTypeEnum,
  displayName: z.string().nullable(),
  type: ChangeTypeEnum,
  createdBy: UserSchema.optional(),
  createdAt: z.string().datetime(),
  data: z.any(),
});

export const NotificationSchema = z.object({
  id: z.number(),
  objectId: z.number(),
  objectType: ObjectTypeEnum,
  fromUser: UserSchema.optional(),
  createdAt: z.string().datetime(),
  read: z.boolean(),
  ref: z.union([TastingSchema, FollowSchema, z.null()]),
});

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

export const AuthSchema = z.object({
  user: UserSchema,
  accessToken: z.string().optional(),
});

export const StoreTypeEnum = z.enum(STORE_TYPE_LIST);

export const StoreSchema = z.object({
  id: z.number(),
  type: StoreTypeEnum,
  name: z.string(),
  country: z.string().nullable(),
  lastRunAt: z.string().datetime().nullable(),
});

export const StoreInputSchema = z.object({
  type: StoreTypeEnum,
  name: z.string(),
  country: z.string().nullable().optional(),
});

export const StorePriceSchema = z.object({
  name: z.string(),
  price: z.number(),
  url: z.string(),
  store: StoreSchema.optional(),
  updatedAt: z.string().datetime(),
});

export const StorePriceInputSchema = z.object({
  name: z.string(),
  price: z.number(),
  url: z.string(),
});
