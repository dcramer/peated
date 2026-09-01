import type { Outputs } from "@peated/server/orpc/router";

import {
  BottleList,
  ButtonLink,
  EmptyState,
  LoadingList,
  SectionError,
  TextLink,
} from "@peated/web/components";
import { PageSection } from "@peated/web/components/pages/pageLayout.stylex";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { getEntityUrl } from "@peated/web/lib/urls";

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
  const isDistillery = entity.kind === "distillery";
  const heading = isDistillery ? "Popular other bottlings" : "Popular bottles";
  const viewAllParams = new URLSearchParams({ sort: "-tastings" });
  if (isDistillery) viewAllParams.set("view", "other");

  if (!entityHasBottleCatalog(entity)) return null;

  if (pending) {
    return (
      <PageSection heading={heading}>
        <LoadingList label={`Loading ${heading.toLowerCase()}`} rows={4} />
      </PageSection>
    );
  }

  if (error) {
    return (
      <PageSection heading={heading}>
        <SectionError heading={`${heading} are unavailable`} onRetry={retry}>
          The rest of this page still works. Try loading this list again.
        </SectionError>
      </PageSection>
    );
  }

  if (!bottleList?.results.length) {
    if (isDistillery) return null;

    const addBottleHref =
      createBottleHref ??
      `/bottles/new?${new URLSearchParams({
        returnTo: entityHref,
      }).toString()}`;

    return (
      <PageSection heading={heading}>
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

  const total = isDistillery ? bottleList.total : totalBottles;
  const viewAllLabel =
    total === 1
      ? "View 1 bottle"
      : `View all ${total.toLocaleString("en-US")} bottles`;

  return (
    <PageSection
      heading={heading}
      intro={
        <TextLink href={`${entityHref}/bottles?${viewAllParams.toString()}`}>
          {viewAllLabel}
        </TextLink>
      }
    >
      <BottleList
        ariaLabel={
          isDistillery
            ? `${entity.name} popular other bottlings`
            : `${entity.name} popular bottles`
        }
        items={bottleList.results.map((bottle) =>
          toBottleListItem(bottle, {
            includeBottler: isDistillery,
            includeRatings: true,
            includeRelatedReleases: true,
          }),
        )}
      />
    </PageSection>
  );
}
