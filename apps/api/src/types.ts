import type { z } from "zod";
import type {
  BadgeAwardSchema,
  BadgeCheckSchema,
  BadgeCheckTypeEnum,
  BadgeFormulaEnum,
  BadgeSchema,
  BadgeTrackerEnum,
  BottleReleaseSchema,
  BottleSchema,
  CaskFillEnum,
  CaskSizeEnum,
  CaskTypeEnum,
  CategoryEnum,
  ChangeSchema,
  CollectionBottleSchema,
  CollectionSchema,
  CommentSchema,
  CountrySchema,
  CurrencyEnum,
  EntityInputSchema,
  EntitySchema,
  EntityTypeEnum,
  EventSchema,
  ExternalSiteSchema,
  ExternalSiteTypeEnum,
  FlavorProfileEnum,
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
  ServingStyleEnum,
  StorePriceSchema,
  TagCategoryEnum,
  TastingSchema,
  UserSchema,
} from "./schemas";

export type Category = z.infer<typeof CategoryEnum>;
export type ServingStyle = z.infer<typeof ServingStyleEnum>;
export type FlavorProfile = z.infer<typeof FlavorProfileEnum>;
export type TagCategory = z.infer<typeof TagCategoryEnum>;
export type Currency = z.infer<typeof CurrencyEnum>;
export type CaskType = z.infer<typeof CaskTypeEnum>;
export type CaskSize = z.infer<typeof CaskSizeEnum>;
export type CaskFill = z.infer<typeof CaskFillEnum>;

export type ExternalSiteType = z.infer<typeof ExternalSiteTypeEnum>;
export type BadgeCheckType = z.infer<typeof BadgeCheckTypeEnum>;
export type BadgeTracker = z.infer<typeof BadgeTrackerEnum>;
export type BadgeFormula = z.infer<typeof BadgeFormulaEnum>;

export type EntityType = z.infer<typeof EntityTypeEnum>;
export type ObjectType = z.infer<typeof ObjectTypeEnum>;
export type FollowStatus = z.infer<typeof FollowStatusEnum>;
export type FriendStatus = z.infer<typeof FriendStatusEnum>;
export type Point = z.infer<typeof PointSchema>;

export type Badge = z.infer<typeof BadgeSchema>;
export type BadgeAward = z.infer<typeof BadgeAwardSchema>;
export type BadgeCheck = z.infer<typeof BadgeCheckSchema>;
export type Bottle = z.infer<typeof BottleSchema>;
export type BottleRelease = z.infer<typeof BottleReleaseSchema>;
export type Change = z.infer<typeof ChangeSchema>;
export type Collection = z.infer<typeof CollectionSchema>;
export type CollectionBottle = z.infer<typeof CollectionBottleSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type Country = z.infer<typeof CountrySchema>;
export type Event = z.infer<typeof EventSchema>;
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
  releaseYear?: number | null;
};

// blame theo for this monstrosity
export const createTuple = <T extends Readonly<{ id: string }[]>>(arr: T) =>
  arr.map((s) => s.id) as {
    [K in keyof T]: T[K] extends { id: infer U } ? U : never;
  };
