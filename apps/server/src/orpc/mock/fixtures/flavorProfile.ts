import { TAG_CATEGORIES } from "@peated/server/constants";
import type { FlavorProfile } from "@peated/server/schemas/flavorProfile";

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
