import type { Outputs } from "@peated/server/orpc/router";

import {
  BottleComparisonTable,
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
      <PageSection heading={presentation.bottleSectionLabel}>
        <LoadingList label="Loading associated bottles" rows={4} />
      </PageSection>
    );
  }

  if (error) {
    return (
      <PageSection heading={presentation.bottleSectionLabel}>
        <SectionError
          heading="Associated bottles are unavailable"
          onRetry={retry}
        >
          The entity record is still available. Try loading its bottles again.
        </SectionError>
      </PageSection>
    );
  }

  if (!bottleList?.results.length) {
    const isBottling = presentation.bottleSectionLabel === "Bottlings";
    const addBottleHref =
      createBottleHref ??
      `/bottles/new?${new URLSearchParams({
        returnTo: entityHref,
      }).toString()}`;

    return (
      <PageSection heading={presentation.bottleSectionLabel}>
        <EmptyState
          action={
            <ButtonLink href={addBottleHref} size="sm" variant="accent">
              Add a bottle
            </ButtonLink>
          }
          heading={isBottling ? "No bottlings yet" : "No bottles yet"}
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
      count={bottleList.results.length}
      heading={presentation.bottleSectionLabel}
      intro={
        <TextLink href={`${entityHref}/bottles?sort=-tastings`}>
          View all {totalBottles.toLocaleString("en-US")} bottles
        </TextLink>
      }
    >
      <BottleComparisonTable
        ariaLabel={`${entity.name} ${presentation.bottleSectionLabel.toLowerCase()}`}
        columns={["Rating"]}
        rows={[
          toBottleTableRow(firstBottle),
          ...remainingBottles.map((bottle) => toBottleTableRow(bottle)),
        ]}
      />
    </PageSection>
  );
}
