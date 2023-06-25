import type {
  CATEGORY_LIST,
  COUNTRY_LIST,
  SERVING_STYLE_LIST,
  STORE_TYPE_LIST,
} from "./constants";

export type Category = (typeof CATEGORY_LIST)[number];

export type ServingStyle = (typeof SERVING_STYLE_LIST)[number];

export type StoreType = (typeof STORE_TYPE_LIST)[number];

export type Country = (typeof COUNTRY_LIST)[number];

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
  rel?: PagingRel;
};
