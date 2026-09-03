import type { Outputs } from "@peated/server/orpc/router";
import { getEntityIdentityProps } from "@peated/web/lib/entityIdentity";

import {
  EntityIdentityRow,
  ItemListItem,
  LoadingList,
  RailList,
  SectionError,
} from "@peated/web/components";
import { PageSection } from "@peated/web/components/pages/pageLayout.stylex";
import { getEntityUrl } from "@peated/web/lib/urls";

import type { Entity } from "./entityPageData";

type EntityCatalog = Outputs["entities"]["catalog"];
type RelatedEntity =
  | EntityCatalog["related"]["bottlers"][number]
  | EntityCatalog["related"]["distillers"][number];

function getRelationshipGroup(entity: Entity, catalog?: EntityCatalog) {
  if (!catalog) return null;

  const groups: {
    heading: string;
    itemLabel: string;
    items: RelatedEntity[];
  }[] =
    entity.kind === "distillery"
      ? [
          {
            heading: "Bottled by",
            itemLabel: "bottlers",
            items: catalog.related.bottlers,
          },
        ]
      : entity.kind === "brand"
        ? [
            {
              heading: "Distilled at",
              itemLabel: "distilleries",
              items: catalog.related.distillers,
            },
            {
              heading: "Bottled by",
              itemLabel: "bottlers",
              items: catalog.related.bottlers,
            },
          ]
        : [
            {
              heading: "Distilleries",
              itemLabel: "distilleries",
              items: catalog.related.distillers,
            },
          ];

  return groups.find((group) => group.items.length) ?? null;
}

export function EntityCatalogRelationships({
  catalog,
  entity,
  error,
  pending,
  retry,
}: {
  catalog?: EntityCatalog;
  entity: Entity;
  error: boolean;
  pending: boolean;
  retry: () => void;
}) {
  if (entity.kind === "company") return null;

  const group = getRelationshipGroup(entity, catalog);
  const state =
    group ??
    (entity.kind === "brand"
      ? {
          heading: "Distilleries and bottlers",
          itemLabel: "distilleries and bottlers",
        }
      : entity.kind === "distillery"
        ? { heading: "Bottled by", itemLabel: "bottlers" }
        : { heading: "Distilleries", itemLabel: "distilleries" });

  if (pending) {
    return (
      <PageSection heading={state.heading}>
        <LoadingList label={`Loading ${state.itemLabel}`} rows={3} />
      </PageSection>
    );
  }

  if (error) {
    return (
      <PageSection heading={state.heading}>
        <SectionError
          heading={`Could not load ${state.itemLabel}`}
          onRetry={retry}
        >
          Try again.
        </SectionError>
      </PageSection>
    );
  }

  if (!group) return null;

  return (
    <PageSection heading={group.heading}>
      <RailList ariaLabel={`${entity.name} ${group.heading.toLowerCase()}`}>
        {group.items.map((related) => (
          <ItemListItem key={related.id}>
            <EntityIdentityRow
              {...getEntityIdentityProps(related)}
              variant="sidebar"
              end={`${related.count.toLocaleString("en-US")} ${related.count === 1 ? "bottle" : "bottles"}`}
              href={getEntityUrl(related)}
            />
          </ItemListItem>
        ))}
      </RailList>
    </PageSection>
  );
}
