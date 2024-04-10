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

export function notesForProfile(profile: FlavorProfile): string {
  switch (profile) {
    case "young_spritely":
      return "Vibrant and youthful, bursting with lively essence and energy.";
    case "sweet_fruit_mellow":
      return "Defined by sweet and fruity undertones, often presenting a smooth and mellow disposition.";
    case "spicy_sweet":
      return "Balancing the interplay of spiciness and sweetness for a dynamic sensory experience.";
    case "spicy_dry":
      return "Prioritizing spicier and peppery tones within its profile.";
    case "deep_rich_dried_fruit":
      return "Delving into deep, rich essences reminiscent of dried fruits with a robust sweetness.";
    case "old_dignified":
      return "Typically older, showcasing mature and complex nuances.";
    case "light_delicate":
      return "Characterized by gentle essences and a delicate touch.";
    case "juicy_oak_vanilla":
      return "Revealing notes of fruitiness combined with distinct characters of oak and vanilla.";
    case "oily_coastal":
      return "Reflecting maritime influences, often marked by an oily texture.";
    case "lightly_peated":
      return "With a discreet presence of peat smoke, gently accentuating the spectrum without overwhelming.";
    case "peated":
      return "Where the influence of peat smoke is noticeable, offering more intensity than its lightly peated counterparts.";
    case "heavily_peated":
      return "Bold and dominant with peat smoke character, standing at the forefront of its essence.";
    default:
      return "";
  }
}
