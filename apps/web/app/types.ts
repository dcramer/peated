import type {
  ComponentPropsWithoutRef,
  ElementType,
  PropsWithChildren,
} from "react";

import type { Category, StoreType } from "@peated/shared/types";

export type EntityType = "brand" | "distiller" | "bottler";

// lat, lng
export type Point = [number, number];

// e.g. Hibiki
export type Entity = {
  id: number;
  name: string;
  // e.g. Scotland
  country?: string;
  // e.g. Speyside
  region?: string;
  location: Point;
  type: EntityType[];
  totalBottles: number;
  totalTastings: number;
  createdAt: string;
  createdBy?: User;
};

export type Bottle = {
  id: number;
  name: string;
  brand: Entity;
  distillers: Entity[];
  bottler?: Entity;
  category?: Category | null;
  statedAge?: number;
  totalTastings: number;
  createdAt: string;
  createdBy?: User;
};

export type FollowStatus = "none" | "following" | "pending";

export type FollowRequest = {
  id: number;
  status: FollowStatus;
  createdAt: string;
  user: User;
  followsBack: FollowStatus;
};

export type Friend = {
  id: number;
  status: FollowStatus;
  createdAt: string;
  user: User;
};

export type User = {
  id: number;
  username: string;
  displayName: string;
  pictureUrl?: string;
  private: boolean;

  admin?: boolean;
  mod?: boolean;
  email?: string;
};

export type Tasting = {
  id: number;
  bottle: Bottle;
  // optional location for check-in
  location?: Location | null;
  // e.g. "Bold", "Peaty", more or less tags
  tags: string[];
  // people that you're with
  friends: string[];
  // 1-5, floating point to make half ratings possible
  notes?: string;
  rating: number;
  imageUrl?: string;

  createdBy: User;
  createdAt: string;
  hasToasted: boolean;
  toasts: number;
  comments: number;
};

export type Comment = {
  id: number;
  tastingId: string;
  comment: string;
  createdBy: User;
  createdAt: string;
};

export type ObjectType = "bottle" | "entity" | "tasting" | "toast" | "follow";

export type Change = {
  id: number;
  objectId: number;
  objectType: "bottle" | "entity";
  displayName: string;
  type: "add" | "update" | "delete";
  createdAt: string;
  createdBy?: User;
  data: Record<string, any>;
};

type BaseNotification = {
  id: number;
  objectId: number;
  createdAt: string;
  fromUser?: User;
  read: boolean;
};

export type FollowNotification = BaseNotification & {
  objectType: "follow";
  ref: FollowRequest;
};

export type TastingRef = {
  id: number;
  bottle: {
    id: number;
    name: string;
    brand: {
      id: number;
      name: string;
    };
  };
};

export type ToastNotification = BaseNotification & {
  objectType: "toast";
  ref: TastingRef;
};

export type CommentNotification = BaseNotification & {
  objectType: "comment";
  ref: TastingRef;
};

export type Notification =
  | FollowNotification
  | ToastNotification
  | CommentNotification;

export type Collection = {
  id: number;
  name: string;
  totalBottles: number;
  createdAt?: string;
  createdBy?: User;
};

export type CollectionBottle = {
  id: number;
  bottle: Bottle;
};

// locations are where you're tasting from (e.g. a bar, a distillery)
export type Location = {
  id: number;
  name: string;
};

export type SessionPayload = {
  user: User;
  accessToken: string;
};

export type PolymorphicAsProp<E extends ElementType> = {
  as?: E;
};

export type PolymorphicProps<E extends ElementType> = PropsWithChildren<
  ComponentPropsWithoutRef<E> & PolymorphicAsProp<E>
>;

export type Tag = { tag: string; count: number };

export type Store = {
  id: string;
  name: string;
  type: StoreType;
  lastRunAt: string;
};

export type StorePrice = {
  name: string;
  price: number;
  url: string;
  bottleId?: string | null;
  store?: Store;
  updatedAt: string;
};
