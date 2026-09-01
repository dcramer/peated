import type { Outputs } from "@peated/server/orpc/router";

import {
  BottleTable,
  ButtonLink,
  EmptyState,
  LoadingList,
  SectionError,
  TextLink,
} from "@peated/web/components";
import { PageSection } from "@peated/web/components/pages/pageLayout.stylex";
import { getEntityUrl } from "@peated/web/lib/urls";

import { toBottleTableRow } from "./entityBottleTableRows";
import {
  entityHasBottleCatalog,
  getEntityPresentation,
  type Entity,
} from "./entityPageData";

type BottleList = Outputs["bottles"]["list"];

export function EntityBottleOverview({
  bottleList,
  createBottleHref,
  entity,
  error,
  pending,
  retry,
  totalBottles,
}: {
  bottleList?: BottleList;
  createBottleHref?: string;
  entity: Entity;
  error: boolean;
  pending: boolean;
  retry: () => void;
  totalBottles: number;
}) {
  const presentation = getEntityPresentation(entity);
  const entityHref = getEntityUrl(entity);

  if (!entityHasBottleCatalog(entity)) return null;

  if (pending) {
    return (
      <PageSection heading="Popular bottles">
        <LoadingList label="Loading popular bottles" rows={4} />
      </PageSection>
    );
  }

  if (error) {
    return (
      <PageSection heading="Popular bottles">
        <SectionError heading="Popular bottles are unavailable" onRetry={retry}>
          The rest of this page still works. Try loading its popular bottles
          again.
        </SectionError>
      </PageSection>
    );
  }

  if (!bottleList?.results.length) {
    const addBottleHref =
      createBottleHref ??
      `/bottles/new?${new URLSearchParams({
        returnTo: entityHref,
      }).toString()}`;

    return (
      <PageSection heading="Popular bottles">
        <EmptyState
          action={
            <ButtonLink href={addBottleHref} size="sm" variant="accent">
              Add a bottle
            </ButtonLink>
          }
          heading="No bottles yet"
        >
          No {presentation.bottleSectionLabel.toLowerCase()} have been added for
          {entity.name} yet.
        </EmptyState>
      </PageSection>
    );
  }

  const [firstBottle, ...remainingBottles] = bottleList.results;

  return (
    <PageSection
      heading="Popular bottles"
      intro={
        <TextLink href={`${entityHref}/bottles?sort=-tastings`}>
          View all {totalBottles.toLocaleString("en-US")} bottles
        </TextLink>
      }
    >
      <BottleTable
        ariaLabel={`${entity.name} popular bottles`}
        columns={["Rating"]}
        rows={[
          toBottleTableRow(firstBottle),
          ...remainingBottles.map((bottle) => toBottleTableRow(bottle)),
        ]}
      />
    </PageSection>
  );
}
