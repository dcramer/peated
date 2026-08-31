import type { Outputs } from "@peated/server/orpc/router";

import {
  LoadingList,
  RailList,
  RailListItem,
  SectionError,
} from "@peated/web/components";
import { PageSection } from "@peated/web/components/pages/pageLayout.stylex";
import { getEntityUrl } from "@peated/web/lib/urls";

import type { Entity } from "./entityPageData";

type EntityCatalog = Outputs["entities"]["catalog"];
type RelatedEntity = EntityCatalog["related"]["brands"][number];

function getRelationshipGroup(entity: Entity, catalog?: EntityCatalog) {
  if (!catalog) return null;

  const candidates: Array<{
    heading: string;
    items: RelatedEntity[];
  }> =
    entity.kind === "brand"
      ? [
          { heading: "Distillers", items: catalog.related.distillers },
          { heading: "Bottlers", items: catalog.related.bottlers },
        ]
      : [{ heading: "Brands", items: catalog.related.brands }];

  return candidates.find((candidate) => candidate.items.length > 0) ?? null;
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

  if (pending) {
    return (
      <PageSection heading="Related brands and producers">
        <LoadingList label="Loading related brands and producers" rows={3} />
      </PageSection>
    );
  }

  if (error) {
    return (
      <PageSection heading="Related brands and producers">
        <SectionError
          heading="Related brands and producers are unavailable"
          onRetry={retry}
        >
          Try loading the related brands and producers again.
        </SectionError>
      </PageSection>
    );
  }

  const group = getRelationshipGroup(entity, catalog);
  if (!group) return null;

  return (
    <PageSection heading={group.heading}>
      <RailList ariaLabel={`${entity.name} ${group.heading.toLowerCase()}`}>
        {group.items.map((related) => (
          <RailListItem
            end={related.count.toLocaleString("en-US")}
            href={getEntityUrl(related)}
            key={related.id}
            metadata={related.kind === "brand" ? "Bottle brand" : undefined}
            title={related.shortName || related.name}
          />
        ))}
      </RailList>
    </PageSection>
  );
}
