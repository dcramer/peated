// these are %'s, so floating point
// export type MashBill = {
//   barley: number;
//   corn: number;
//   rye: number;
//   wheat: number;
// };

export enum Category {
  blend,
  blended_grain,
  blended_malt,
  blended_scotch,
  single_grain,
  single_malt,
  spirit,
}

// e.g. Suntory Whisky
export type Distiller = {
  id: string;
  name: string;
  // e.g. Scotland
  country: string;
  // e.g. Speyside
  region?: string;
};

// e.g. Hibiki
export type Brand = {
  id: string;
  name: string;
  // e.g. Scotland
  country: string;
  // e.g. Speyside
  region?: string;
};

export type Bottle = {
  id: string;
  name: string;
  brand?: Brand | null;
  // e.g. the limited release/collection
  series?: string | null;

  distiller?: Distiller | null;
  category?: Category | null;

  // floating point as percentage
  abv?: number | null;

  // e.g. 12 [years]
  statedAge?: number | null;
};

export type User = {
  id: string;
  displayName: string;
};

export type Checkin = {
  id: string;
  bottle: Bottle;
  // optional location for check-in
  location?: Location | null;
  tastingNotes?: string | null;
  // e.g. "Bold", "Peaty", more or less tags
  tags: string[];
  // people that you're with
  friends: string[];
  // 1-5, floating point to make half ratings possible
  rating: number;
  user: User;
};

// locations are where you're checking-in from (e.g. a bar, a distillery)
export type Location = {
  id: string;
  name: string;
};
