import { type Category } from "@peated/server/src/types";

export type StorePrice = {
  name: string;
  price: number;
  priceUnit: string;
  url: string;
  volume: number;
};

export type BottleReview = {
  name: string;
  category: Category | null;
  rating: number;
  url: string;
  issue?: string;
  publishedAt?: Date;
};
