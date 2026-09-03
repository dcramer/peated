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

import { type Entity } from "./entityPageData";

type EntityList = Outputs["entities"]["list"];

export function EntityOperatedOverview({
  entity,
  error,
  operatedList,
  pending,
  retry,
}: {
  entity: Entity;
  error: boolean;
  operatedList?: EntityList;
  pending: boolean;
  retry: () => void;
}) {
  if (entity.kind !== "company") return null;

  const heading = "Operates";

  if (pending) {
    return (
      <PageSection heading={heading}>
        <LoadingList label="Loading brands and producers" rows={2} />
      </PageSection>
    );
  }

  if (error) {
    return (
      <PageSection heading={heading}>
        <SectionError
          heading="Could not load brands and producers"
          onRetry={retry}
        >
          Try again.
        </SectionError>
      </PageSection>
    );
  }

  const operated = operatedList?.results.slice(0, 4) ?? [];
  if (!operated.length) return null;

  return (
    <PageSection heading={heading}>
      <RailList ariaLabel={`${entity.name} brands and producers`}>
        {operated.map((item) => (
          <ItemListItem key={item.id}>
            <EntityIdentityRow
              {...getEntityIdentityProps(item)}
              variant="sidebar"
              href={getEntityUrl(item)}
            />
          </ItemListItem>
        ))}
      </RailList>
    </PageSection>
  );
}
