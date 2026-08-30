import type { Outputs } from "@peated/server/orpc/router";

import {
  LoadingList,
  RailList,
  RailListItem,
  SectionError,
} from "@peated/web/components/designSystem/components";
import { PageSection } from "@peated/web/components/designSystem/patterns/pageLayout.stylex";
import { getEntityUrl } from "@peated/web/lib/urls";

import { getEntityPresentation, type Entity } from "./entityPageData";

type EntityList = Outputs["entities"]["list"];

export function EntitySiblingOverview({
  entity,
  error,
  pending,
  retry,
  siblingList,
}: {
  entity: Entity;
  error: boolean;
  pending: boolean;
  retry: () => void;
  siblingList?: EntityList;
}) {
  if (!entity.ownerId) return null;

  const heading = entity.owner?.name
    ? `Also owned by ${entity.owner.name}`
    : "Also owned";

  if (pending) {
    return (
      <PageSection heading={heading}>
        <LoadingList label="Loading related entities" rows={3} />
      </PageSection>
    );
  }

  if (error) {
    return (
      <PageSection heading={heading}>
        <SectionError
          heading="Related entities are unavailable"
          onRetry={retry}
        >
          Try loading the related entities again.
        </SectionError>
      </PageSection>
    );
  }

  const siblings = siblingList?.results
    .filter((sibling) => sibling.id !== entity.id)
    .slice(0, 4);
  if (!siblings?.length) return null;

  return (
    <PageSection heading={heading}>
      <RailList ariaLabel={heading}>
        {siblings.map((sibling) => (
          <RailListItem
            href={getEntityUrl(sibling)}
            key={sibling.id}
            metadata={`${getEntityPresentation(sibling).label} · ${sibling.totalBottles.toLocaleString("en-US")} bottles`}
            title={sibling.name}
          />
        ))}
      </RailList>
    </PageSection>
  );
}
