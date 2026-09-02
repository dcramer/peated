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
  notedTastings: 12,
  categories: TAG_CATEGORIES.map((category, index) => ({
    category,
    tastingCount: [4, 5, 1, 10, 3, 0, 6, 2, 4][index]!,
    notes: [
      [{ name: "malt", tastingCount: 4 }],
      [{ name: "lemon zest", tastingCount: 5 }],
      [{ name: "heather", tastingCount: 1 }],
      [
        { name: "peat", tastingCount: 8 },
        { name: "bonfire", tastingCount: 6 },
      ],
      [{ name: "leather", tastingCount: 3 }],
      [],
      [{ name: "honey", tastingCount: 6 }],
      [{ name: "clove", tastingCount: 2 }],
      [{ name: "oak", tastingCount: 4 }],
    ][index]!,
  })),
};
