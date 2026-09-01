import type { Outputs } from "@peated/server/orpc/router";
import type { PageTabItem } from "@peated/web/components";
import { getEntityUrl } from "@peated/web/lib/urls";

export type Entity = Outputs["entities"]["details"];
type EntityTabSource = Pick<
  Entity,
  "id" | "kind" | "name" | "shortName" | "totalBottles" | "totalTastings"
>;
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

export function getEntityRelationshipOwnerIds(
  entity: Pick<Entity, "id" | "kind" | "ownerId">,
) {
  return {
    operatedOwnerId: entity.kind === "company" ? entity.id : null,
    siblingOwnerId: entity.ownerId,
  };
}

export function getEntityLocationLabel(entity: Entity) {
  return [entity.region?.name, entity.country?.name]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

export function getEntityTabs(
  entity: EntityTabSource,
): [PageTabItem, ...PageTabItem[]] {
  const baseUrl = getEntityUrl(entity);
  const tabs: [PageTabItem, ...PageTabItem[]] = [
    { href: baseUrl, label: "Overview" },
    {
      count: entity.totalBottles,
      href: `${baseUrl}/bottles`,
      label: "Bottles",
    },
    {
      count: entity.totalTastings,
      href: `${baseUrl}/tastings`,
      label: "Tastings",
    },
  ];

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
