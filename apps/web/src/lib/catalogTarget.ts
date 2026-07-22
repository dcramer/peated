import type { CatalogTargetV1 } from "@peated/server/schemas";

export function getCatalogTargetLabel(target: CatalogTargetV1) {
  return target.kind === "bottle"
    ? target.bottle.fullName
    : target.group.fullName;
}

export function getCatalogTargetHref(target: CatalogTargetV1) {
  return target.kind === "bottle"
    ? `/bottles/${target.bottle.id}`
    : `/bottle-groups/${target.group.id}`;
}

export function getCatalogTargetScopeLabel(target: CatalogTargetV1) {
  return target.kind === "bottle"
    ? "Exact bottle"
    : "Exact bottle not specified";
}

export function getCatalogTargetStats(target: CatalogTargetV1) {
  const owner = target.kind === "bottle" ? target.bottle : target.group;
  return {
    totalTastings: owner.totalTastings,
    avgRating: owner.avgRating,
    statedAge: owner.statedAge,
  };
}
