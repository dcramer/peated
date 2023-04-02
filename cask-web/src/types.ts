// the distillery
export type Producer = {
  id: string;
  name: string;
  // e.g. Scotland
  country: string;
  // e.g. Speyside
  region?: string;
};

// these are %'s, so floating point
export type MashBill = {
  barley: number;
  corn: number;
  rye: number;
  wheat: number;
};

export enum Category {
  Blend,
  BlendedMalt,
  SingleMalt,
  Spirit,
}

// e.g. Suntory Whisky
export type Bottler = {
  id: string;
  name: string;
};

// e.g. Hibiki
export type Brand = {
  id: string;
  name: string;
};

// DisplayName is: [Brand] [Name] [Series]
// if Brand is empty it uses the Producer instead and is considered their base
// Producer=Hibiki Brand=Hibiki, Name=12, Series=None, DisplayName=Hibiki 12
// Producer=Macallan, Brand=Blended Malt, Series=Mythic Journey, DisplayName=Macallan Blended Malt Mythic Journey
export type Bottle = {
  id: string;
  name: string;
  brand?: Brand | null;
  bottler?: Bottler | null;
  producer: Producer | null;
  category?: Category | null;

  // floating point as percentage
  abv?: number | null;

  // e.g. 12 [years]
  statedAge?: number | null;

  // TODO: should vintage and bottling be full dates? optional month/day?
  // the distillation date
  vintageYear?: number | null;
  // the bottle date
  bottleYear?: number | null;

  // e.g. the limited release/collection
  series?: string | null;

  // e.g. Plum Liqueur Barrels
  caskType?: string | null;
  caskNumber?: string | null;
  // total number of bottles in line
  totalBottles?: number | null;
  mashBill?: MashBill | null;
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
