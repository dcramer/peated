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
