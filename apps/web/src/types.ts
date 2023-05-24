// these are %'s, so floating point
// export type MashBill = {
//   barley: number;
//   corn: number;
//   rye: number;
//   wheat: number;
// };

export type Category =
  | "blend"
  | "bourbon"
  | "rye"
  | "single_grain"
  | "single_malt"
  | "spirit";

export type EntityType = "brand" | "distiller" | "bottler";

// e.g. Hibiki
export type Entity = {
  id: number;
  name: string;
  // e.g. Scotland
  country?: string;
  // e.g. Speyside
  region?: string;
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
  admin: boolean;
  mod: boolean;
  username: string;
  displayName: string;
  email: string;
  pictureUrl?: string;
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

  series?: string;
  vintageYear?: number;
  barrel?: number;

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
  series?: string;
  vintageYear?: number;
  barrel?: number;
};

export type Notification =
  | FollowNotification
  | ToastNotification
  | CommentNotification;

// locations are where you're tasting from (e.g. a bar, a distillery)
export type Location = {
  id: number;
  name: string;
};

type NextPagingRel =
  | {
      nextPage: number;
      next: string;
    }
  | {
      nextPage: null;
      next: null;
    };

type PrevPagingRel =
  | {
      prevPage: number;
      prev: string;
    }
  | {
      prevPage: null;
      prev: null;
    };

export type PagingRel = NextPagingRel & PrevPagingRel;

export type Paginated<T> = {
  results: T[];
  rel: PagingRel;
};
