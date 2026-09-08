import type { Outputs } from "@peated/server/orpc/router";

import {
  ItemList,
  ItemListItem,
  LoadingList,
  SectionError,
  SeriesIdentityRow,
  TextLink,
} from "@peated/web/components";
import { PageSection } from "@peated/web/components/pages/pageLayout.stylex";
import { getBottleSeriesUrl, getEntityUrl } from "@peated/web/lib/urls";

import type { Entity } from "./entityPageData";

type BottleSeriesList = Outputs["bottleSeries"]["list"];

export function EntitySeriesOverview({
  entity,
  error,
  pending,
  retry,
  seriesList,
}: {
  entity: Entity;
  error: boolean;
  pending: boolean;
  retry: () => void;
  seriesList?: BottleSeriesList;
}) {
  if (entity.kind !== "distillery") return null;

  if (pending) {
    return (
      <PageSection heading="Series">
        <LoadingList label={`Loading ${entity.name} series`} rows={4} />
      </PageSection>
    );
  }

  if (error) {
    return (
      <PageSection heading="Series">
        <SectionError heading="Series are unavailable" onRetry={retry}>
          The rest of this page still works. Try loading the series again.
        </SectionError>
      </PageSection>
    );
  }

  if (!seriesList?.results.length) return null;

  const viewAllLabel =
    seriesList.total === 1
      ? "View 1 series"
      : `View all ${seriesList.total.toLocaleString("en-US")} series`;

  return (
    <PageSection
      heading="Series"
      intro={
        <TextLink href={`${getEntityUrl(entity)}/series`}>
          {viewAllLabel}
        </TextLink>
      }
    >
      <ItemList ariaLabel={`${entity.name} series`}>
        {seriesList.results.map((series) => (
          <ItemListItem key={series.id}>
            <SeriesIdentityRow
              brand={series.brand.name}
              end={formatBottleCount(series.numBottles)}
              href={getBottleSeriesUrl(series)}
              name={series.name}
            />
          </ItemListItem>
        ))}
      </ItemList>
    </PageSection>
  );
}

function formatBottleCount(count: number) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "bottle" : "bottles"}`;
}
