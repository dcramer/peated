import type { Outputs } from "@peated/server/orpc/router";
import type { PageTabItem } from "@peated/web/components/designSystem/components";

export type Entity = Outputs["entities"]["details"];

const entityKindPresentation = {
  blender: {
    bottleSectionLabel: "Bottlings",
    establishmentLabel: "Founded",
    label: "Blender",
  },
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

export function getEntityPresentation(entity: Entity) {
  return entity.kind
    ? entityKindPresentation[entity.kind]
    : fallbackPresentation;
}

export function getEntityLocationLabel(entity: Entity) {
  return [entity.region?.name, entity.country?.name]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

export function getEntityTabs(entity: Entity): [PageTabItem, ...PageTabItem[]] {
  const baseUrl = `/entities/${entity.id}`;
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
