import { Category } from "../types";

export function toTitleCase(value: string) {
  var words = value.toLowerCase().split(" ");
  for (var i = 0; i < words.length; i++) {
    words[i] = (words[i][0] || "").toUpperCase() + words[i].slice(1);
  }
  return words.join(" ");
}

export function formatCategoryName(
  value: Category | string | undefined | null
) {
  if (!value) return "";
  return toTitleCase(`${value}`.replace("_", " "));
}
