import type { Outputs } from "@peated/server/orpc/router";
import type { PageTabItem } from "@peated/web/components";
import { getEntityUrl } from "@peated/web/lib/urls";

export type Entity = Outputs["entities"]["details"];
type EntityTabSource = Pick<
  Entity,
  "id" | "kind" | "name" | "shortName" | "totalBottles" | "totalTastings"
>;
export type CompanyPageCounts = {
  bottles: number;
  portfolio: number;
};
const entityKindPresentation = {
  bottler: {
    bottleSectionLabel: "Bottles",
    label: "Bottler",
  },
  brand: {
    bottleSectionLabel: "Bottles",
    label: "Brand",
  },
  company: {
    bottleSectionLabel: "Bottles",
    label: "Company",
  },
  distillery: {
    bottleSectionLabel: "Bottles",
    label: "Distillery",
  },
} as const;

const fallbackPresentation = {
  bottleSectionLabel: "Bottles",
  label: "Brand or producer",
} as const;

export function getEntityPresentation(entity: Pick<Entity, "kind">) {
  return entity.kind
    ? entityKindPresentation[entity.kind]
    : fallbackPresentation;
}

export function getEntityClassification(entity: Pick<Entity, "kind">) {
  return getEntityPresentation(entity).label;
}

export function entityHasBottleCatalog(entity: Pick<Entity, "kind">) {
  return (
    entity.kind === "brand" ||
    entity.kind === "bottler" ||
    entity.kind === "distillery"
  );
}

export function getDistilleryBottleView(
  entity: Pick<Entity, "kind">,
  view: string | string[] | undefined,
  fallback: "other" | "releases" = "releases",
) {
  if (entity.kind !== "distillery") return undefined;
  return view === "other" || view === "releases" ? view : fallback;
}

export function getEntityLocationLabel(entity: Entity) {
  return [entity.region?.name, entity.country?.name]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

export function getEntityTabs(
  entity: EntityTabSource,
  companyCounts?: CompanyPageCounts,
): [PageTabItem, ...PageTabItem[]] {
  const baseUrl = getEntityUrl(entity);
  const tabs: [PageTabItem, ...PageTabItem[]] = [
    { href: baseUrl, label: "Overview" },
  ];

  if (entity.kind === "company" && companyCounts?.portfolio) {
    tabs.push({
      count: companyCounts.portfolio,
      href: `${baseUrl}/portfolio`,
      label: "Portfolio",
    });
  }

  const totalBottles =
    entity.kind === "company"
      ? (companyCounts?.bottles ?? entity.totalBottles)
      : entity.totalBottles;
  if (entityHasBottleCatalog(entity) || totalBottles > 0) {
    tabs.push({
      count: totalBottles,
      href: `${baseUrl}/bottles`,
      label: "Bottles",
    });
  }

  if (entityHasBottleCatalog(entity)) {
    tabs.push({
      count: entity.totalTastings,
      href: `${baseUrl}/tastings`,
      label: "Tastings",
    });
  }

  if (entity.shortName === "SMWS") {
    tabs.push({ href: `${baseUrl}/codes`, label: "Distillery codes" });
  }

  return tabs;
}

export function getEntityCurrentHref(
  entity: Pick<Entity, "id" | "kind" | "name" | "peatedId">,
  pathname: string,
) {
  return pathname === `/${entity.peatedId}` ? getEntityUrl(entity) : pathname;
}
