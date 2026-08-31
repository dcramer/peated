import type { Outputs } from "@peated/server/orpc/router";

import {
  BottleComparisonTable,
  LoadingList,
  SectionError,
  TextLink,
} from "@peated/web/components";
import { PageSection } from "@peated/web/components/pages/pageLayout.stylex";
import { getEntityUrl } from "@peated/web/lib/urls";

import { toBottleTableRow } from "./entityBottleTableRows";
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

  if (pending) {
    return (
      <PageSection heading="Latest releases">
        <LoadingList label="Loading latest releases" rows={4} />
      </PageSection>
    );
  }

  if (error) {
    return (
      <PageSection heading="Latest releases">
        <SectionError heading="Latest releases are unavailable" onRetry={retry}>
          Try loading the latest releases again.
        </SectionError>
      </PageSection>
    );
  }

  if (!releaseList?.results.length) return null;

  const [firstRelease, ...remainingReleases] = releaseList.results;

  return (
    <PageSection
      heading="Latest releases"
      intro={
        <TextLink href={`${getEntityUrl(entity)}/bottles?sort=-release`}>
          View all releases
        </TextLink>
      }
    >
      <BottleComparisonTable
        ariaLabel={`${entity.name} latest releases`}
        columns={["Rating"]}
        rows={[
          toBottleTableRow(firstRelease),
          ...remainingReleases.map((bottle) => toBottleTableRow(bottle)),
        ]}
      />
    </PageSection>
  );
}
