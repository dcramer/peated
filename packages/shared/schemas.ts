import { z } from "zod";

const FollowStatusEnum = z.enum(["pending", "following", "none"]);

export const UserSchema = z.object({
  id: z.number(),
  displayName: z.string().trim().min(1, "Required"),
  username: z.string().trim().min(1, "Required"),
  pictureUrl: z.string(),

  email: z.string().email().optional(),
  admin: z.boolean().optional(),
  mod: z.boolean().optional(),
  createdAt: z.string().datetime().optional(),
  followStatus: FollowStatusEnum.optional(),
});

export const UserInputSchema = z.object({
  displayName: z.string().trim().min(1, "Required"),
  username: z.string().trim().min(1, "Required"),
  admin: z.boolean().optional(),
  mod: z.boolean().optional(),
});

const EntityTypeEnum = z.enum(["brand", "bottler", "distiller"]);

export const EntityInputSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  country: z.string().trim().optional(),
  region: z.string().trim().optional(),
  type: z.array(EntityTypeEnum).optional(),
});

export const EntitySchema = z.object({
  id: z.number(),
  name: z.string().trim().min(1, "Required"),
  country: z.string().trim().optional(),
  region: z.string().trim().optional(),
  type: z.array(EntityTypeEnum),

  totalTastings: z.number(),
  totalBottles: z.number(),

  createdAt: z.string().datetime().optional(),
  createdBy: UserSchema.optional(),
});

const CategoryEnum = z.enum([
  "blend",
  "bourbon",
  "rye",
  "single_grain",
  "single_malt",
  "spirit",
]);

export const BottleSchema = z.object({
  id: z.number(),
  name: z.string().trim().min(1, "Required"),
  brand: EntitySchema,
  distillers: z.array(EntitySchema),
  statedAge: z.number().nullable(),
  category: CategoryEnum.nullable(),

  createdAt: z.string().datetime().optional(),
  createdBy: UserSchema.optional(),
});

export const BottleInputSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  brand: z.union([EntityInputSchema, z.number()]),
  distillers: z.array(z.union([EntityInputSchema, z.number()])).optional(),
  statedAge: z.number().nullable().optional(),
  category: CategoryEnum.nullable().optional(),
});

const VintageSchema = z.object({
  series: z.string().nullable(),
  barrel: z.number().nullable(),
  vintageYear: z.number().gte(1495).lte(new Date().getFullYear()).nullable(),
});

export const TastingSchema = z
  .object({
    id: z.number(),
    imageUrl: z.string().nullable(),
    notes: z.string().nullable(),
    bottle: BottleSchema,
    rating: z.number().gte(0).lte(5).nullable(),
    tags: z.array(z.string()),

    comments: z.number().gte(0),
    toasts: z.number().gte(0),
    hasToasted: z.boolean().optional(),
    createdAt: z.string().datetime(),
    createdBy: UserSchema,
  })
  .merge(VintageSchema);

export const TastingInputSchema = z
  .object({
    bottle: z.number(),
    notes: z.string().nullable().optional(),
    rating: z.number().gte(0).lte(5).nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),

    createdAt: z.string().datetime().optional(),
  })
  .merge(VintageSchema.partial());

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

export const CollectionBottleSchema = z
  .object({
    bottle: BottleSchema,
  })
  .merge(VintageSchema);

export const CollectionBottleInputSchema = z
  .object({
    bottle: z.number(),
  })
  .merge(VintageSchema.partial());

export const FollowSchema = z.object({
  id: z.number(),
  status: FollowStatusEnum,
  user: UserSchema,
  createdAt: z.string().datetime().optional(),
  followsBack: FollowStatusEnum,
});

const ObjectTypeEnum = z.enum(["follow", "toast", "comment"]);

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

  rel: PagingRelSchema,
});

export const AuthSchema = z.object({
  user: UserSchema,
  accessToken: z.string().optional(),
});
