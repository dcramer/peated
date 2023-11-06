import { toTitleCase } from "@peated/core/lib/strings";
import type { Category } from "@peated/core/types";

export function formatCategoryName(
  value: Category | string | undefined | null,
) {
  if (!value) return "";
  return toTitleCase(`${value}`.replace(/_/g, " "));
}
