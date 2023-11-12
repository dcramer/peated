import type { z } from "zod";
import type {
  BADGE_TYPE_LIST,
  CATEGORY_LIST,
  COUNTRY_LIST,
  SERVING_STYLE_LIST,
  STORE_TYPE_LIST,
} from "./constants";
import type {
  BadgeSchema,
  BottleSchema,
  ChangeSchema,
  CollectionBottleSchema,
  CollectionSchema,
  CommentSchema,
  EntitySchema,
  EntityTypeEnum,
  FlightSchema,
  FollowSchema,
  FollowStatusEnum,
  FriendSchema,
  FriendStatusEnum,
  NotificationSchema,
  ObjectTypeEnum,
  PointSchema,
  StorePriceSchema,
  StoreSchema,
  TastingSchema,
  UserSchema,
} from "./schemas";

export type Category = (typeof CATEGORY_LIST)[number];
export type ServingStyle = (typeof SERVING_STYLE_LIST)[number];
export type StoreType = (typeof STORE_TYPE_LIST)[number];
export type Country = (typeof COUNTRY_LIST)[number];
export type BadgeType = (typeof BADGE_TYPE_LIST)[number];

export type EntityType = z.infer<typeof EntityTypeEnum>;
export type ObjectType = z.infer<typeof ObjectTypeEnum>;
export type FollowStatus = z.infer<typeof FollowStatusEnum>;
export type FriendStatus = z.infer<typeof FriendStatusEnum>;
export type Point = z.infer<typeof PointSchema>;

export type Badge = z.infer<typeof BadgeSchema>;
export type Bottle = z.infer<typeof BottleSchema>;
export type Change = z.infer<typeof ChangeSchema>;
export type Collection = z.infer<typeof CollectionSchema>;
export type CollectionBottle = z.infer<typeof CollectionBottleSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type Entity = z.infer<typeof EntitySchema>;
export type Flight = z.infer<typeof FlightSchema>;
export type Follow = z.infer<typeof FollowSchema>;
export type Friend = z.infer<typeof FriendSchema>;
export type Notification = z.infer<typeof NotificationSchema>;
export type Store = z.infer<typeof StoreSchema>;
export type StorePrice = z.infer<typeof StorePriceSchema>;
export type Tasting = z.infer<typeof TastingSchema>;
export type User = z.infer<typeof UserSchema>;

export type Tag = { tag: string; count: number };

type NextPagingRel =
  | {
      nextCursor: number;
    }
  | {
      nextCursor: null;
    };

type PrevPagingRel =
  | {
      prevCursor: number;
    }
  | {
      prevCursor: null;
    };

export type PagingRel = NextPagingRel & PrevPagingRel;

export type Paginated<T> = {
  results: T[];
  rel?: PagingRel;
};
