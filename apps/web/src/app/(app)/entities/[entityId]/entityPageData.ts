import type { Outputs } from "@peated/server/orpc/router";
import type { PageTabItem } from "@peated/web/components";
import { getEntityUrl } from "@peated/web/lib/urls";

export type Entity = Outputs["entities"]["details"];
type EntityTabSource = Pick<
  Entity,
  "id" | "kind" | "shortName" | "totalBottles" | "totalTastings"
>;
type EntityLocation = Pick<NonNullable<Entity["country"]>, "name">;
type EntityClassificationSource = Pick<Entity, "kind" | "yearEstablished"> & {
  country?: EntityLocation | null;
  region?: EntityLocation | null;
};

const entityKindPresentation = {
  bottler: {
    bottleSectionLabel: "Bottlings",
    establishmentLabel: "Founded",
    label: "Bottler",
  },
  brand: {
    bottleSectionLabel: "Bottles",
    establishmentLabel: "Established",
    label: "Brand",
  },
  company: {
    bottleSectionLabel: "Bottles",
    establishmentLabel: "Founded",
    label: "Company",
  },
  distillery: {
    bottleSectionLabel: "Bottlings",
    establishmentLabel: "Founded",
    label: "Distillery",
  },
} as const;

const fallbackPresentation = {
  bottleSectionLabel: "Bottles",
  establishmentLabel: "Established",
  label: "Entity",
} as const;

export function getEntityPresentation(entity: Pick<Entity, "kind">) {
  return entity.kind
    ? entityKindPresentation[entity.kind]
    : fallbackPresentation;
}

export function getEntityClassification(entity: EntityClassificationSource) {
  const presentation = getEntityPresentation(entity);
  const location = entity.region?.name ?? entity.country?.name;

  return [
    presentation.label,
    entity.yearEstablished
      ? `${presentation.establishmentLabel.toLowerCase()} ${entity.yearEstablished}`
      : null,
    location,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

export function getEntityOwnerLabel(
  entity: Pick<Entity, "kind">,
  owner: Pick<Entity, "name" | "shortName">,
) {
  const ownerName = owner.shortName || owner.name;

  return entity.kind === "brand"
    ? `A ${ownerName} brand`
    : `Part of ${ownerName}`;
}

export function entityHasBottleCatalog(entity: Pick<Entity, "kind">) {
  return (
    entity.kind === "brand" ||
    entity.kind === "bottler" ||
    entity.kind === "distillery"
  );
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
  entity: Pick<Entity, "id" | "kind" | "peatedId">,
  pathname: string,
) {
  return pathname === `/${entity.peatedId}` ? getEntityUrl(entity) : pathname;
}
