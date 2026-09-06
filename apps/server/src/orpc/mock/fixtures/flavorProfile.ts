import { TAG_CATEGORIES } from "@peated/server/constants";
import type {
  BottleFlavorProfile,
  FlavorProfile,
} from "@peated/server/schemas/flavorProfile";

export const mockFlavorProfile: FlavorProfile = {
  totalBottles: 40,
  notedBottles: 24,
  categories: TAG_CATEGORIES.map((category, index) => ({
    category,
    bottleCount: [10, 19, 5, 20, 3, 1, 13, 8, 12][index]!,
    notes: [
      ["biscuit", "malt"],
      ["apple", "lemon zest"],
      ["heather", "cut grass"],
      ["brine", "ash"],
      ["leather", "tobacco"],
      ["struck match"],
      ["vanilla", "honey"],
      ["pepper", "clove"],
      ["oak", "sherry"],
    ][index]!.map((name) => ({ name, bottleCount: 1 })),
  })),
};

export const mockBottleFlavorProfile: BottleFlavorProfile = {
  notedReviewAndTastingCount: 12,
  notedTastings: 12,
  categories: TAG_CATEGORIES.map((category, index) => ({
    category,
    reviewAndTastingCount: [4, 5, 1, 10, 3, 0, 6, 2, 4][index]!,
    tastingCount: [4, 5, 1, 10, 3, 0, 6, 2, 4][index]!,
    notes: [
      [{ name: "malt", reviewAndTastingCount: 4, tastingCount: 4 }],
      [{ name: "lemon zest", reviewAndTastingCount: 5, tastingCount: 5 }],
      [{ name: "heather", reviewAndTastingCount: 1, tastingCount: 1 }],
      [
        { name: "peat", reviewAndTastingCount: 8, tastingCount: 8 },
        { name: "bonfire", reviewAndTastingCount: 6, tastingCount: 6 },
      ],
      [{ name: "leather", reviewAndTastingCount: 3, tastingCount: 3 }],
      [],
      [{ name: "honey", reviewAndTastingCount: 6, tastingCount: 6 }],
      [{ name: "clove", reviewAndTastingCount: 2, tastingCount: 2 }],
      [{ name: "oak", reviewAndTastingCount: 4, tastingCount: 4 }],
    ][index]!,
  })),
};
