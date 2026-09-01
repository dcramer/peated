import type { Outputs } from "@peated/server/orpc/router";

import {
  BottleList,
  LoadingList,
  SectionError,
  TextLink,
} from "@peated/web/components";
import { PageSection } from "@peated/web/components/pages/pageLayout.stylex";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { getEntityUrl } from "@peated/web/lib/urls";

import { entityHasBottleCatalog, type Entity } from "./entityPageData";

type BottleList = Outputs["bottles"]["list"];

export function EntityReleaseOverview({
  entity,
  error,
  pending,
  releaseList,
  retry,
}: {
  entity: Entity;
  error: boolean;
  pending: boolean;
  releaseList?: BottleList;
  retry: () => void;
}) {
  if (!entityHasBottleCatalog(entity)) return null;
  const isDistillery = entity.kind === "distillery";
  const heading = isDistillery
    ? "Latest distillery releases"
    : "Latest releases";
  const viewAllParams = new URLSearchParams({ sort: "-release" });
  if (isDistillery) viewAllParams.set("view", "releases");

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

  if (!releaseList?.results.length) return null;

  return (
    <PageSection
      heading={heading}
      intro={
        <TextLink
          href={`${getEntityUrl(entity)}/bottles?${viewAllParams.toString()}`}
        >
          View all releases
        </TextLink>
      }
    >
      <BottleList
        ariaLabel={
          isDistillery
            ? `${entity.name} latest distillery releases`
            : `${entity.name} latest releases`
        }
        items={releaseList.results.map((bottle) =>
          toBottleListItem(bottle, {
            includeRatings: true,
            includeRelatedReleases: true,
          }),
        )}
      />
    </PageSection>
  );
}
