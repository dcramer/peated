import type { Outputs } from "@peated/server/orpc/router";

import { BottleList } from "@peated/web/components/bottleList.stylex";
import { ButtonLink } from "@peated/web/components/button.stylex";
import {
  EmptyState,
  LoadingList,
  SectionError,
} from "@peated/web/components/feedback.stylex";
import { PageSection } from "@peated/web/components/pages/pageLayout.stylex";
import { TextLink } from "@peated/web/components/textLink.stylex";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { getEntityUrl } from "@peated/web/lib/urls";

import { entityHasBottleCatalog, type Entity } from "./entityPageData";

type BottleList = Outputs["bottles"]["list"];

/**
 * The one Bottle list on an Entity's Overview: its latest releases (owner:
 * docs/features/entity-page.md). A distillery with no releases of its own
 * shows the latest bottlings of its spirit instead.
 */
export function EntityReleaseOverview({
  createBottleHref,
  entity,
  error,
  latestBottlings,
  pending,
  releaseList,
  retry,
}: {
  createBottleHref?: string;
  entity: Entity;
  error: boolean;
  latestBottlings?: BottleList;
  pending: boolean;
  releaseList?: BottleList;
  retry: () => void;
}) {
  if (!entityHasBottleCatalog(entity)) return null;
  const ownReleases =
    entity.kind !== "distillery" || Boolean(releaseList?.results.length);
  const list = ownReleases ? releaseList : latestBottlings;
  const heading =
    entity.kind !== "distillery"
      ? "Latest releases"
      : ownReleases
        ? "Latest distillery releases"
        : "Latest bottlings";
  const viewAllParams = new URLSearchParams({ sort: "-release" });
  if (entity.kind === "distillery" && ownReleases) {
    viewAllParams.set("view", "releases");
  }

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
          Try loading this list again.
        </SectionError>
      </PageSection>
    );
  }

  if (!list?.results.length) {
    const addBottleHref =
      createBottleHref ??
      `/bottles/new?${new URLSearchParams({
        returnTo: getEntityUrl(entity),
      }).toString()}`;

    return (
      <PageSection heading="Bottles">
        <EmptyState
          action={
            <ButtonLink href={addBottleHref} size="sm" variant="accent">
              Add a bottle
            </ButtonLink>
          }
          heading="No bottles yet"
        >
          No bottles have been added for {entity.name} yet.
        </EmptyState>
      </PageSection>
    );
  }

  return (
    <PageSection
      heading={heading}
      intro={
        <TextLink
          href={`${getEntityUrl(entity)}/bottles?${viewAllParams.toString()}`}
        >
          {entity.kind === "distillery" && ownReleases
            ? "View all releases"
            : `View all ${entity.totalBottles.toLocaleString("en-US")} bottles`}
        </TextLink>
      }
    >
      <BottleList
        ariaLabel={`${entity.name} ${heading.toLowerCase()}`}
        items={list.results.map((bottle) =>
          toBottleListItem(bottle, {
            includeBottler: !ownReleases,
            includeRatings: true,
            includeRelatedReleases: true,
          }),
        )}
      />
    </PageSection>
  );
}
