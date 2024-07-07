import type { z } from "zod";
import type {
  BADGE_TYPE_LIST,
  CASK_FILLS,
  CASK_SIZE_IDS,
  CASK_TYPE_IDS,
  CATEGORY_LIST,
  CURRENCY_LIST,
  EXTERNAL_SITE_TYPE_LIST,
  FLAVOR_PROFILES,
  SERVING_STYLE_LIST,
  TAG_CATEGORIES,
} from "./constants";
import type {
  BadgeSchema,
  BottleSchema,
  ChangeSchema,
  CollectionBottleSchema,
  CollectionSchema,
  CommentSchema,
  CountrySchema,
  EntityInputSchema,
  EntitySchema,
  EntityTypeEnum,
  ExternalSiteSchema,
  FlightSchema,
  FollowSchema,
  FollowStatusEnum,
  FriendSchema,
  FriendStatusEnum,
  NotificationSchema,
  ObjectTypeEnum,
  PointSchema,
  RegionSchema,
  ReviewSchema,
  StorePriceSchema,
  TastingSchema,
  UserSchema,
} from "./schemas";

export type Category = (typeof CATEGORY_LIST)[number];
export type ServingStyle = (typeof SERVING_STYLE_LIST)[number];
export type FlavorProfile = (typeof FLAVOR_PROFILES)[number];
export type TagCategory = (typeof TAG_CATEGORIES)[number];
export type Currency = (typeof CURRENCY_LIST)[number];
export type CaskType = (typeof CASK_TYPE_IDS)[number];
export type CaskSize = (typeof CASK_SIZE_IDS)[number];
export type CaskFill = (typeof CASK_FILLS)[number];

export type ExternalSiteType = (typeof EXTERNAL_SITE_TYPE_LIST)[number];
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
export type Country = z.infer<typeof CountrySchema>;
export type Region = z.infer<typeof RegionSchema>;
export type ExternalSite = z.infer<typeof ExternalSiteSchema>;
export type Entity = z.infer<typeof EntitySchema>;
export type Flight = z.infer<typeof FlightSchema>;
export type Follow = z.infer<typeof FollowSchema>;
export type Friend = z.infer<typeof FriendSchema>;
export type Notification = z.infer<typeof NotificationSchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type StorePrice = z.infer<typeof StorePriceSchema>;
export type Tasting = z.infer<typeof TastingSchema>;
export type User = z.infer<typeof UserSchema>;

export type Tag = {
  name: string;
  tagCategory: TagCategory;
  flavorProfiles: FlavorProfile[];
};
export type SuggestedTag = { tag: Tag; count: number };

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

export type EntityInput =
  | number
  | {
      id?: number;
      name: string;
      countryId?: number | null;
      regionId?: number | null;
      type?: ("brand" | "bottler" | "distiller")[];
    };

type FreeformEntity =
  | z.infer<typeof EntityInputSchema>
  | z.infer<typeof EntitySchema>;

export type BottlePreviewResult = {
  name: string;
  category?: Category | null;
  brand: FreeformEntity;
  bottler?: FreeformEntity | null;
  distillers?: FreeformEntity[] | null;
  statedAge?: number | null;
  flavorProfile?: FlavorProfile | null;
  caskSize?: CaskSize | null;
  caskType?: CaskType | null;
  caskFill?: CaskFill | null;
  vintageYear?: number | null;
  releaseDate?: string | null;
};

// blame theo for this monstrosity
export const createTuple = <T extends Readonly<{ id: string }[]>>(arr: T) =>
  arr.map((s) => s.id) as {
    [K in keyof T]: T[K] extends { id: infer U } ? U : never;
  };
