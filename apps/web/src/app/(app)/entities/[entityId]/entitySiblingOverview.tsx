import type { Outputs } from "@peated/server/orpc/router";
import { getEntityIdentityProps } from "@peated/web/lib/entityIdentity";

import {
  EntityIdentityRow,
  ItemListItem,
  LoadingList,
  RailList,
  SectionError,
  TextLink,
} from "@peated/web/components";
import { PageSection } from "@peated/web/components/pages/pageLayout.stylex";
import { getEntityUrl } from "@peated/web/lib/urls";

import { type Entity } from "./entityPageData";
import { getEntitySiblings } from "./entitySiblingData";

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
    ? `Also part of ${entity.owner.name}`
    : "Other distilleries and bottlers";
  const companyLink = entity.owner ? (
    <TextLink href={getEntityUrl(entity.owner)}>View company</TextLink>
  ) : null;

  if (pending) {
    return (
      <PageSection heading={heading} intro={companyLink}>
        <LoadingList label="Loading distilleries and bottlers" rows={3} />
      </PageSection>
    );
  }

  if (error) {
    return (
      <PageSection heading={heading} intro={companyLink}>
        <SectionError
          heading="Could not load distilleries and bottlers"
          onRetry={retry}
        >
          Try again.
        </SectionError>
      </PageSection>
    );
  }

  const siblings = getEntitySiblings(entity.id, siblingList);
  if (!siblings.length) {
    return companyLink ? (
      <PageSection heading={heading} intro={companyLink}>
        {null}
      </PageSection>
    ) : null;
  }

  return (
    <PageSection heading={heading} intro={companyLink}>
      <RailList ariaLabel={heading}>
        {siblings.map((sibling) => (
          <ItemListItem key={sibling.id}>
            <EntityIdentityRow
              {...getEntityIdentityProps(sibling)}
              variant="sidebar"
              href={getEntityUrl(sibling)}
            />
          </ItemListItem>
        ))}
      </RailList>
    </PageSection>
  );
}
