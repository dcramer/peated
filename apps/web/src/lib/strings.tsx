import { toTitleCase } from "@peated/shared/lib/strings";
import { Category } from "../types";

export function formatCategoryName(
  value: Category | string | undefined | null,
) {
  if (!value) return "";
  return toTitleCase(`${value}`.replace("_", " "));
}
