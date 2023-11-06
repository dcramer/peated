import { toTitleCase } from "@peated/server/lib/strings";
import type { Category } from "@peated/server/types";

export function formatCategoryName(
  value: Category | string | undefined | null,
) {
  if (!value) return "";
  return toTitleCase(`${value}`.replace(/_/g, " "));
}
