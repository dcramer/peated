"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { getEntityIdentityProps } from "@peated/web/lib/entityIdentity";
import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useState, type ReactNode } from "react";

import {
  EntityIdentityRow,
  FactList,
  ItemListItem,
  LoadingList,
  LoadingPlaceholder,
  RailList,
  RatingSummary,
  SectionError,
  TextLink,
} from "@peated/web/components";
import Markdown from "@peated/web/components/markdown";
import {
  PageColumns,
  PageHeader,
} from "@peated/web/components/pages/pageLayout.stylex";
import { RailListSection } from "@peated/web/components/pages/railListSection.stylex";
import { FlavorProfileSection } from "@peated/web/features/flavorProfile/flavorProfileSection";
import { useORPC } from "@peated/web/lib/orpc/context";
import { getEntityUrl } from "@peated/web/lib/urls";
import { space } from "../../../../styles/tokens.stylex";

type Series = Outputs["bottleSeries"]["details"];

type SeriesPageFrameValue = {
  hasCurrentUser: boolean;
  series: Series;
};

const SeriesPageFrameContext = createContext<SeriesPageFrameValue | null>(null);
const DISTILLERY_PREVIEW_LIMIT = 5;
const COMPACT = "@media (max-width: 639px)";
const loadingRowCounts = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function SeriesPageFrame({
  children,
  hasCurrentUser,
  initialSeries,
}: {
  children: ReactNode;
  hasCurrentUser: boolean;
  initialSeries: Series;
}) {
  return (
    <SeriesPageFrameContext.Provider
      value={{ hasCurrentUser, series: initialSeries }}
    >
      <div {...stylex.props(styles.page)}>
        <PageHeader
          description={
            initialSeries.description ? (
              <Markdown content={initialSeries.description} />
            ) : undefined
          }
          parent={
            <TextLink href={getEntityUrl(initialSeries.brand)}>
              {initialSeries.brand.name}
            </TextLink>
          }
          title={
            <span {...stylex.props(styles.title)}>{initialSeries.name}</span>
          }
        />
        <PageColumns
          rail={
            initialSeries.numReleases > 0 ? (
              <>
                <SeriesRatingSection seriesId={initialSeries.id} />
                <FlavorProfileSection
                  showHeading={false}
                  scope={{ kind: "series", series: initialSeries.id }}
                />
                {initialSeries.distillers.length ? (
                  <SeriesDistilleries distillers={initialSeries.distillers} />
                ) : null}
              </>
            ) : undefined
          }
          railBehavior="stack"
        >
          {children}
        </PageColumns>
      </div>
    </SeriesPageFrameContext.Provider>
  );
}

function SeriesRatingSection({ seriesId }: { seriesId: number }) {
  const orpc = useORPC();
  const query = useQuery(
    orpc.bottleSeries.ratingSummary.queryOptions({
      input: { series: seriesId },
    }),
  );
  const rating = query.data;
  const hasRating =
    rating &&
    (rating.memberScoreCount > 0 ||
      rating.externalScoreCount > 0 ||
      Object.values(rating.tastingBandCounts).some((count) => count > 0));

  if (query.isSuccess && !hasRating) return null;

  return (
    <section aria-label="Rating">
      {query.isPending ? (
        <div role="status" aria-label="Loading Series rating">
          <LoadingPlaceholder preset="text" />
        </div>
      ) : query.isError ? (
        <SectionError
          heading="Could not load rating"
          onRetry={() => void query.refetch()}
        >
          Try loading the Series rating again.
        </SectionError>
      ) : rating ? (
        <RatingSummary
          ariaLabel="Series rating"
          externalScoreCount={rating.externalScoreCount}
          memberScoreCount={rating.memberScoreCount}
          median={rating.medianScore}
          tastingCounts={rating.tastingBandCounts}
        />
      ) : null}
    </section>
  );
}

export function SeriesPageContent({
  bottles,
  facts,
  filters,
}: {
  bottles: ReactNode;
  facts: ReactNode;
  filters?: ReactNode;
}) {
  return (
    <>
      {facts}
      {filters ? (
        <div
          aria-label="Library filter"
          role="group"
          {...stylex.props(styles.filters)}
        >
          {filters}
        </div>
      ) : null}
      <div {...stylex.props(styles.bottles)}>{bottles}</div>
    </>
  );
}

/** Reserves the series content geometry inside the stable route frame. */
export function SeriesPageLoading() {
  const { hasCurrentUser, series } = useSeriesPageFrame();
  const showLibrary = hasCurrentUser && series.numReleases > 0;
  const loadingRows =
    loadingRowCounts[
      Math.min(Math.max(series.numReleases, 1), loadingRowCounts.length) - 1
    ] ?? 1;
  const facts = showLibrary
    ? ([
        {
          label: "Bottles",
          value: <LoadingPlaceholder preset="metadata" />,
        },
        {
          label: "In your Library",
          value: <LoadingPlaceholder preset="metadata" />,
        },
      ] as const)
    : ([
        {
          label: "Bottles",
          value: <LoadingPlaceholder preset="metadata" />,
        },
      ] as const);

  return (
    <div aria-busy="true" aria-label="Loading series bottles" role="status">
      <SeriesPageContent
        facts={<FactList facts={facts} layout="grid" />}
        filters={
          showLibrary ? <LoadingPlaceholder preset="heading" /> : undefined
        }
        bottles={
          <div aria-hidden="true">
            <div {...stylex.props(styles.loadingToolbar)}>
              <LoadingPlaceholder preset="heading" />
              <LoadingPlaceholder preset="metadata" />
            </div>
            <LoadingList
              label="Loading bottles in this series"
              rows={loadingRows}
            />
          </div>
        }
      />
    </div>
  );
}

export function useSeriesPageFrame() {
  const value = useContext(SeriesPageFrameContext);
  if (!value) throw new Error("Series content requires its route frame");
  return value;
}

function SeriesDistilleries({
  distillers,
}: {
  distillers: Series["distillers"];
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = distillers.length > DISTILLERY_PREVIEW_LIMIT;
  const visibleDistillers = expanded
    ? distillers
    : distillers.slice(0, DISTILLERY_PREVIEW_LIMIT);

  return (
    <RailListSection
      action={
        hasMore
          ? {
              ariaControls: "series-distilleries",
              expanded,
              label: expanded
                ? "Show fewer distilleries"
                : `View all ${distillers.length.toLocaleString("en-US")} distilleries`,
              onClick: () => setExpanded((value) => !value),
            }
          : undefined
      }
      heading={distillers.length === 1 ? "Distillery" : "Distilleries"}
    >
      <div id="series-distilleries">
        <RailList ariaLabel="Series distilleries">
          {visibleDistillers.map((distiller) => (
            <ItemListItem key={distiller.id}>
              <EntityIdentityRow
                {...getEntityIdentityProps(distiller)}
                variant="sidebar"
                end={`${distiller.numBottles.toLocaleString("en-US")} ${
                  distiller.numBottles === 1 ? "bottle" : "bottles"
                }`}
                href={getEntityUrl(distiller)}
              />
            </ItemListItem>
          ))}
        </RailList>
      </div>
    </RailListSection>
  );
}

const styles = stylex.create({
  page: {
    minWidth: 0,
  },
  title: {
    display: "block",
    fontSize: {
      default: null,
      "@media (max-width: 480px)": "36px",
    },
    overflowWrap: "anywhere",
  },
  filters: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
    flexWrap: "wrap",
  },
  bottles: {
    minWidth: 0,
    paddingTop: space.x4,
  },
  loadingToolbar: {
    display: "flex",
    minHeight: { default: "32px", [COMPACT]: "64px" },
    alignItems: { default: "center", [COMPACT]: "flex-start" },
    justifyContent: "space-between",
    flexDirection: { default: "row", [COMPACT]: "column" },
    gap: space.x4,
    paddingBottom: space.x3,
  },
});
