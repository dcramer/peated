import { Category } from "../types";

export function toTitleCase(value: string) {
  const words = value.toLowerCase().split(" ");
  for (let i = 0; i < words.length; i++) {
    words[i] = (words[i][0] || "").toUpperCase() + words[i].slice(1);
  }
  return words.join(" ");
}

export function formatCategoryName(
  value: Category | string | undefined | null,
) {
  if (!value) return "";
  return toTitleCase(`${value}`.replace("_", " "));
}
