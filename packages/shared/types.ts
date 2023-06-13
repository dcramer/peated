export const CategoryValues = [
  "blend",
  "bourbon",
  "rye",
  "single_grain",
  "single_malt",
  "spirit",
] as const;

export type Category = (typeof CategoryValues)[number];

export const ServingStyleValues = ["neat", "rocks", "splash"] as const;

export type ServingStyle = (typeof ServingStyleValues)[number];

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
