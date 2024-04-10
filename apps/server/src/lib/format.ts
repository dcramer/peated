import { toTitleCase } from "@peated/server/lib/strings";
import type { Category, FlavorProfile } from "@peated/server/types";

export function formatCategoryName(
  value: Category | string | undefined | null,
) {
  if (!value) return "";
  return toTitleCase(`${value}`.replace(/_/g, " "));
}

export function formatFlavorProfile(
  value: FlavorProfile | string | undefined | null,
) {
  if (!value) return "";
  switch (value) {
    case "young_spritely":
      return "Young & Spritely";
    case "sweet_fruit_mellow":
      return "Sweet, Fruity & Mellow";
    case "spicy_sweet":
      return "Spicy & Sweet";
    case "spicy_dry":
      return "Spicy & Dry";
    case "deep_rich_dried_fruit":
      return "Deep, Rich & Dried Fruits";
    case "old_dignified":
      return "Old & Dignified";
    case "light_delicate":
      return "Light & Delicate";
    case "juicy_oak_vanilla":
      return "Juicy, Oak & Vanilla";
    case "oily_coastal":
      return "Oily & Coastal";
    case "lightly_peated":
      return "Lightly Peated";
    case "peated":
      return "Peated";
    case "heavily_peated":
      return "Heavily Peated";
    default:
      return toTitleCase(`${value}`.replace(/_/g, " "));
  }
}
