import { toTitleCase } from "@peated/server/lib/strings";

export type CreateBottleReturnAction =
  | "addBottle"
  | "library"
  | "tasting"
  | "view";

export function getCreateBottleHref({
  query,
  returnAction,
}: {
  query: string;
  returnAction?: CreateBottleReturnAction;
}) {
  const params = new URLSearchParams({
    name: toTitleCase(query),
  });
  if (returnAction) {
    params.set("returnAction", returnAction);
  }
  return `/bottles/new?${params.toString()}`;
}
