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

// e.g. Hibiki
export type Entity = {
  id: string;
  name: string;
  // e.g. Scotland
  country?: string;
  // e.g. Speyside
  region?: string;
  type: ("brand" | "distiller")[];
  totalBottles: number;
  totalTastings: number;
  createdAt: string;
  createdBy?: User;
};

export type Bottle = {
  id: string;
  name: string;
  brand: Entity;
  distillers: Entity[];
  category?: Category | null;
  statedAge?: number;
  totalTastings: number;
  createdAt: string;
  createdBy?: User;
};

export type Edition = {
  id: string;
  name: string;
  bottle: Bottle;
  barrel?: number;
  createdAt: string;
  createdBy?: User;
};

export type FollowStatus = "none" | "following" | "pending";

export type FollowRequest = {
  id: string;
  status: FollowStatus;
  createdAt: string;
  user: User;
  followsBack: FollowStatus;
};

export type Friend = {
  id: string;
  status: FollowStatus;
  createdAt: string;
  user: User;
};

export type User = {
  id: string;
  admin: boolean;
  mod: boolean;
  displayName: string;
  email: string;
  pictureUrl?: string;
};

export type Tasting = {
  id: string;
  bottle: Bottle;
  // optional location for check-in
  location?: Location | null;
  comments?: string | null;
  // e.g. "Bold", "Peaty", more or less tags
  tags: string[];
  // people that you're with
  friends: string[];
  // 1-5, floating point to make half ratings possible
  rating: number;
  imageUrl?: string;
  createdBy: User;
  createdAt: string;
  hasToasted: boolean;
  toasts: number;
};

export type ObjectType =
  | "bottle"
  | "edition"
  | "entity"
  | "tasting"
  | "toast"
  | "follow";

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
  id: string;
  bottle: {
    id: string;
    name: string;
    brand: {
      id: string;
      name: string;
    };
  };
};

export type ToastNotification = BaseNotification & {
  objectType: "toast";
  ref: TastingRef;
};

export type Notification = FollowNotification | ToastNotification;

// locations are where you're tasting from (e.g. a bar, a distillery)
export type Location = {
  id: string;
  name: string;
};

type NextPagingRel =
  | {
      nextPage: string;
      next: string;
    }
  | {
      nextPage: null;
      next: null;
    };

type PrevPagingRel =
  | {
      prevPage: string;
      prev: string;
    }
  | {
      prevPage: null;
      prev: null;
    };

type PagingRel = NextPagingRel & PrevPagingRel;

export type Paginated<T> = {
  results: T[];
  rel: PagingRel;
};
