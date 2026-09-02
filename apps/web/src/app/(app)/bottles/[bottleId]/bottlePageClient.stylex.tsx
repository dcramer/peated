"use client";

import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import {
  formatCategoryName,
  formatColor,
  formatServingStyle,
} from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";

import {
  AppLink,
  BottleRatings,
  Button,
  ButtonLink,
  EmptyState,
  ExpandableDescription,
  LoadingList,
  PageTabs,
  RowMenu,
  SectionError,
  type CriticReviewProps,
  type FactListItem,
  type PageTabItem,
  type RowMenuItem,
  type TastingEntryProps,
} from "@peated/web/components";
import { EntityLinks } from "@peated/web/components/entityLinks";
import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import { BottleOverview } from "@peated/web/components/pages/bottleOverview.stylex";
import { BottlePageHeader } from "@peated/web/components/pages/bottlePageHeader.stylex";
import { BottleRailSection } from "@peated/web/components/pages/bottleRailSection.stylex";
import TimeSince from "@peated/web/components/timeSince";
import { FlavorProfileSection } from "@peated/web/features/flavorProfile/flavorProfileSection";
import useAuth from "@peated/web/hooks/useAuth";
import {
  getAddBottleHref,
  getAddSimilarBottlePath,
} from "@peated/web/lib/addBottle";
import { getBottleReleasePlacement } from "@peated/web/lib/bottleMetadata";
import { logTelemetryError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { selectOtherSeriesBottles } from "@peated/web/lib/seriesBottleRail";
import {
  getBottleSeriesUrl,
  getBottleUrl,
  getEntityUrl,
} from "@peated/web/lib/urls";
import { colors, fonts, space } from "../../../../styles/tokens.stylex";

import { bottleOverviewQueries } from "./bottleOverviewQueries";

type Bottle = Outputs["bottles"]["details"];
type ExternalReview = Outputs["externalReviews"]["list"]["results"][number];
type Tasting = Outputs["tastings"]["list"]["results"][number];

const BottlePageContext = createContext<Bottle | null>(null);

const PHONE = "@media (max-width: 480px)";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function getBottleEyebrow(bottle: Bottle) {
  return bottle.distillers.length ? (
    <EntityLinks entities={bottle.distillers} />
  ) : null;
}

function getDeclaredFacts(bottle: Bottle): [FactListItem, ...FactListItem[]] {
  return [
    {
      label: "Series",
      value: bottle.series ? (
        <AppLink href={getBottleSeriesUrl(bottle.series)}>
          {bottle.series.name}
        </AppLink>
      ) : null,
    },
    {
      label: "Category",
      value: bottle.category ? formatCategoryName(bottle.category) : null,
    },
    {
      label: "Bottled by",
      value: bottle.bottler ? (
        <EntityLinks entities={[bottle.bottler]} />
      ) : null,
    },
    {
      label: "Strength",
      value: bottle.caskStrength ? "Cask strength" : null,
    },
    {
      label: "Cask selection",
      value: bottle.singleCask ? "Single cask" : null,
    },
    {
      label: "ABV",
      value: bottle.abv === null ? null : `${bottle.abv.toFixed(1)}%`,
    },
    {
      label: "Age",
      value:
        bottle.statedAge === null
          ? bottle.noAgeStatement
            ? "No age statement"
            : null
          : `${bottle.statedAge} years`,
    },
    { label: "Cask", value: bottle.maturation },
    { label: "Cask number", value: bottle.caskNumber },
    {
      label: "Outturn",
      value:
        bottle.outturn === null
          ? null
          : `${bottle.outturn.toLocaleString("en-US")} bottles`,
    },
    {
      label: "Release",
      value: getBottleReleasePlacement(bottle).header,
    },
    {
      label: "Vintage",
      value: bottle.vintageYear === null ? null : String(bottle.vintageYear),
    },
    {
      label: "Bottled",
      value: bottle.bottlingYear === null ? null : String(bottle.bottlingYear),
    },
    {
      label: "Released",
      value: getBottleReleasePlacement(bottle).details,
    },
    {
      label: "Phenols",
      value:
        bottle.maltPhenolPpm === null
          ? null
          : `${bottle.maltPhenolPpm.toLocaleString("en-US")} PPM`,
    },
    {
      label: "Coloring",
      value:
        bottle.naturalColor === null
          ? null
          : bottle.naturalColor
            ? "Natural color"
            : "Color added",
    },
    {
      label: "Filtration",
      value:
        bottle.nonChillFiltered === null
          ? null
          : bottle.nonChillFiltered
            ? "Non-chill filtered"
            : "Chill filtered",
    },
  ];
}

function getCriticReview(
  externalReview: ExternalReview,
): CriticReviewProps | null {
  if (!externalReview.site) return null;

  return {
    href: externalReview.url,
    publication: externalReview.site.name,
    publishedAt: externalReview.article.publishedAt
      ? dateFormatter.format(new Date(externalReview.article.publishedAt))
      : undefined,
    rating:
      externalReview.nativeScore?.scale === 100
        ? externalReview.nativeScore.value
        : null,
    reviewerName: externalReview.reviewerName ?? undefined,
    summary: externalReview.clip ?? undefined,
  };
}

function getTasting(tasting: Tasting, bottle: Bottle): TastingEntryProps {
  const member = {
    color: tasting.color === null ? undefined : formatColor(tasting.color),
    comments: tasting.comments,
    notes: tasting.notes ?? undefined,
    notesHref: `/tastings/${tasting.id}`,
    hasToasted: tasting.hasToasted,
    imageKind: tasting.imageUrl ? ("photo" as const) : ("bottle" as const),
    imageUrl: tasting.imageUrl ?? bottle.imageUrl,
    name: formatBottleDisplayName(bottle, { includeBrand: false }),
    tags: tasting.tags,
    ratingBand: tasting.ratingBand ?? undefined,
    servingStyle: tasting.servingStyle
      ? formatServingStyle(tasting.servingStyle)
      : undefined,
    tastingId: tasting.id,
    toasts: tasting.toasts,
  };

  return {
    author: tasting.createdBy.username,
    authorHref: `/users/${tasting.createdBy.username}`,
    authorId: tasting.createdBy.id,
    date: <TimeSince date={tasting.createdAt} />,
    members: [member],
  };
}

function getTabs(bottle: Bottle): [PageTabItem, ...PageTabItem[]] {
  const baseUrl = getBottleUrl(bottle);
  const tabs: [PageTabItem, ...PageTabItem[]] = [
    { href: baseUrl, label: "Overview" },
    {
      count: bottle.totalTastings,
      href: `${baseUrl}/tastings`,
      label: "Tastings",
    },
    { href: `${baseUrl}/prices`, label: "Prices" },
  ];

  if (bottle.group && bottle.group.totalBottles > 1) {
    tabs.push({
      count: bottle.group.totalBottles,
      href: `${baseUrl}/releases`,
      label: "Releases",
    });
  }

  return tabs;
}

function BottleLibraryAction({ bottle }: { bottle: Bottle }) {
  const { user } = useAuth();
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { flash } = useFlashMessages();
  const [libraryOverride, setLibraryOverride] = useState<boolean | null>(null);
  const addMutation = useMutation(
    orpc.collections.bottles.create.mutationOptions(),
  );
  const removeMutation = useMutation(
    orpc.collections.bottles.delete.mutationOptions(),
  );

  if (!user) {
    return (
      <ButtonLink href="/login" size="lg" variant="tonal">
        Add to Library
      </ButtonLink>
    );
  }

  const isLibrary = libraryOverride ?? bottle.isLibrary;
  const pending = addMutation.isPending || removeMutation.isPending;

  return (
    <Button
      aria-pressed={isLibrary}
      loading={pending}
      loadingLabel={isLibrary ? "Removing…" : "Adding…"}
      onClick={async () => {
        try {
          if (isLibrary) {
            await removeMutation.mutateAsync({
              bottle: bottle.id,
              collection: "library",
              user: "me",
            });
          } else {
            await addMutation.mutateAsync({
              bottle: bottle.id,
              collection: "library",
              user: "me",
            });
          }
          setLibraryOverride(!isLibrary);
          await queryClient.invalidateQueries({
            queryKey: orpc.bottles.details.key({
              input: { bottle: bottle.id },
            }),
          });
        } catch (error) {
          flash(
            error instanceof Error
              ? error.message
              : "Unable to update your library.",
            "error",
          );
        }
      }}
      size="lg"
      variant="tonal"
    >
      {isLibrary ? "In Library" : "Add to Library"}
    </Button>
  );
}

function BottleActions({ bottle }: { bottle: Bottle }) {
  const { user } = useAuth();
  const orpc = useORPC();
  const router = useRouter();
  const { flash } = useFlashMessages();
  const deleteMutation = useMutation(orpc.bottles.delete.mutationOptions());
  const groups: RowMenuItem[][] = [
    [
      {
        href: getAddSimilarBottlePath(bottle.id),
        label: "Add a similar bottle",
      },
      {
        label: "Share",
        onSelect: () => {
          if (navigator.share) {
            navigator
              .share({
                title: formatBottleDisplayName(bottle),
                url: window.location.href,
              })
              .catch((error) => logTelemetryError(error, {}));
            return;
          }

          void navigator.clipboard
            .writeText(window.location.href)
            .then(() => flash("Bottle link copied."))
            .catch((error) => logTelemetryError(error, {}));
        },
      },
    ],
  ];

  if (user?.mod || user?.admin) {
    groups.push([
      { href: `/bottles/${bottle.id}/aliases`, label: "Manage other names" },
      { href: `/bottles/${bottle.id}/edit`, label: "Edit bottle" },
      { href: `/bottles/${bottle.id}/merge`, label: "Merge bottle" },
      { href: `/bottles/${bottle.id}/audit`, label: "Audit bottle" },
    ]);
  }

  if (user?.admin) {
    groups.push([
      {
        disabled: deleteMutation.isPending,
        label: deleteMutation.isPending ? "Deleting bottle…" : "Delete bottle",
        onSelect: () => {
          if (
            !window.confirm(
              "Permanently delete this bottle? This cannot be undone.",
            )
          ) {
            return;
          }
          void deleteMutation
            .mutateAsync({ bottle: bottle.id })
            .then(() => router.replace("/bottles"))
            .catch((error) => {
              flash(
                error instanceof Error
                  ? error.message
                  : "Unable to delete this bottle.",
                "error",
              );
            });
        },
      },
    ]);
  }

  return <RowMenu groups={groups} label="Bottle actions" variant="page" />;
}

export function BottlePageFrameClient({
  children,
  initialBottle,
}: {
  children: ReactNode;
  initialBottle: Bottle;
}) {
  const orpc = useORPC();
  const pathname = usePathname();
  const bottleQuery = useQuery({
    ...orpc.bottles.details.queryOptions({
      input: { bottle: initialBottle.id },
    }),
    initialData: initialBottle,
  });

  if (bottleQuery.error) {
    return (
      <SectionError
        heading="Bottle details are unavailable"
        onRetry={() => void bottleQuery.refetch()}
      >
        We could not load this bottle. Try again.
      </SectionError>
    );
  }

  const bottle = bottleQuery.data;
  const currentHref =
    pathname === `/${bottle.peatedId}` ? getBottleUrl(bottle) : pathname;

  return (
    <BottlePageContext.Provider value={bottle}>
      <div {...stylex.props(styles.page)}>
        <BottlePageHeader
          actions={
            <>
              <ButtonLink
                href={getAddBottleHref({
                  bottleId: bottle.id,
                  intent: "tasting",
                })}
                size="lg"
                variant="accent"
              >
                Log a tasting
              </ButtonLink>
              <BottleLibraryAction bottle={bottle} />
            </>
          }
          bands={
            Object.values(bottle.tastingBandCounts).some((count) => count > 0)
              ? { counts: bottle.tastingBandCounts, showCounts: true }
              : null
          }
          brand={bottle.brand.shortName || bottle.brand.name}
          brandHref={getEntityUrl(bottle.brand)}
          eyebrow={getBottleEyebrow(bottle)}
          menu={<BottleActions bottle={bottle} />}
          name={formatBottleDisplayName(bottle, { includeBrand: false })}
          score={
            bottle.scoreCount === 0
              ? null
              : {
                  count: bottle.scoreCount,
                  high: bottle.maxScore,
                  low: bottle.minScore,
                  median: bottle.medianScore,
                }
          }
        />
        {bottle.aliases.length ? (
          <p {...stylex.props(styles.aliases)}>
            <span {...stylex.props(styles.aliasLabel)}>Also known as</span>{" "}
            {bottle.aliases.join(" · ")}
          </p>
        ) : null}
        {bottle.description ? (
          <div {...stylex.props(styles.description)}>
            <ExpandableDescription content={bottle.description} />
          </div>
        ) : null}
        <div {...stylex.props(styles.tabs)}>
          <PageTabs
            ariaLabel="Bottle sections"
            currentHref={currentHref}
            items={getTabs(bottle)}
          />
        </div>
        <div {...stylex.props(styles.overview)}>{children}</div>
      </div>
    </BottlePageContext.Provider>
  );
}

export function BottleOverviewClient() {
  const orpc = useORPC();
  const bottle = useBottlePage();
  const externalReviewsQuery = useQuery(
    bottleOverviewQueries.reviews(orpc, bottle.id),
  );
  const tastingsQuery = useQuery(
    bottleOverviewQueries.tastings(orpc, bottle.id),
  );
  const recommendationsQuery = useQuery(
    bottleOverviewQueries.recommendations(orpc, bottle.id),
  );
  const seriesBottlesQuery = useQuery(
    bottleOverviewQueries.series(orpc, bottle.series?.id),
  );

  const criticReviews =
    externalReviewsQuery.data?.results
      .map(getCriticReview)
      .filter((review): review is CriticReviewProps => review !== null) ?? [];
  const tastings =
    tastingsQuery.data?.results.map((tasting) => getTasting(tasting, bottle)) ??
    [];
  const recommendations =
    recommendationsQuery.data?.results.map((recommendation) => ({
      end: (
        <BottleRatings
          counts={recommendation.tastingBandCounts}
          high={recommendation.maxScore}
          low={recommendation.minScore}
          median={recommendation.medianScore}
          scoreCount={recommendation.scoreCount}
        />
      ),
      href: getBottleUrl(recommendation),
      imageUrl: recommendation.imageUrl,
      metadata: [
        formatCategoryName(recommendation.category),
        recommendation.abv === null
          ? null
          : `${recommendation.abv.toFixed(1)}% ABV`,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" · "),
      name: formatBottleDisplayName(recommendation),
    })) ?? [];
  const otherSeriesBottles = seriesBottlesQuery.data
    ? selectOtherSeriesBottles(seriesBottlesQuery.data.results, bottle.id).map(
        (seriesBottle) => ({
          href: getBottleUrl(seriesBottle),
          imageUrl: seriesBottle.imageUrl,
          metadata: [
            formatCategoryName(seriesBottle.category),
            getBottleReleasePlacement(seriesBottle).header,
          ]
            .filter((value): value is string => Boolean(value))
            .join(" · "),
          name: formatBottleDisplayName(seriesBottle, {
            includeBrand: false,
            includeSeries: false,
          }),
        }),
      )
    : [];
  const seriesRail = !bottle.series ? null : seriesBottlesQuery.isPending ? (
    <BottleRailSection heading="Other bottles in this series">
      <LoadingList label="Loading other bottles in this series" rows={3} />
    </BottleRailSection>
  ) : seriesBottlesQuery.error ? (
    <SectionError
      heading="Other bottles in this series are unavailable"
      onRetry={() => void seriesBottlesQuery.refetch()}
    >
      Try loading this list again.
    </SectionError>
  ) : otherSeriesBottles.length ? (
    <BottleRailSection
      heading="Other bottles in this series"
      items={otherSeriesBottles}
      moreHref={getBottleSeriesUrl(bottle.series)}
      moreLabel={`See all ${(seriesBottlesQuery.data?.total ?? otherSeriesBottles.length + 1).toLocaleString("en-US")} bottles`}
    />
  ) : null;
  const mainPending =
    !criticReviews.length &&
    !tastings.length &&
    (externalReviewsQuery.isPending || tastingsQuery.isPending);
  const mainFailed =
    !criticReviews.length &&
    !tastings.length &&
    !mainPending &&
    Boolean(externalReviewsQuery.error && tastingsQuery.error);
  const mainState = mainPending ? (
    <LoadingList label="Loading bottle reviews and tastings" rows={3} />
  ) : mainFailed ? (
    <SectionError
      heading="Reviews and tastings are unavailable"
      onRetry={() => {
        void externalReviewsQuery.refetch();
        void tastingsQuery.refetch();
      }}
    >
      We could not load this bottle's reviews or tastings. Try again.
    </SectionError>
  ) : !criticReviews.length && !tastings.length ? (
    <EmptyState
      action={
        <ButtonLink
          href={getAddBottleHref({
            bottleId: bottle.id,
            intent: "tasting",
          })}
          size="sm"
          variant="accent"
        >
          Log the first tasting
        </ButtonLink>
      }
      heading="No reviews or tastings yet"
    >
      This bottle has no published critic reviews or community tastings.
    </EmptyState>
  ) : null;

  return (
    <>
      <BottleOverview
        criticReviewDetail={
          externalReviewsQuery.isPending ? "Loading reviews…" : undefined
        }
        criticReviews={criticReviews}
        declaredFacts={getDeclaredFacts(bottle)}
        image={{
          label: formatBottleDisplayName(bottle),
          license: bottle.imageLicense,
          sourceUrl: bottle.imageSourceUrl,
          url: bottle.imageUrl,
        }}
        mainState={mainState}
        moreTastingsHref={`${getBottleUrl(bottle)}/tastings`}
        recommendationState={
          recommendationsQuery.isPending ? (
            <LoadingList label="Loading bottle recommendations" rows={3} />
          ) : undefined
        }
        recommendations={recommendations}
        flavorProfile={
          <FlavorProfileSection
            key={bottle.id}
            scope={{ kind: "bottle", bottle: bottle.id }}
          />
        }
        railSections={seriesRail}
        tastingCount={bottle.totalTastings}
        tastings={tastings}
      />

      {recommendationsQuery.error ||
      (!mainFailed && (externalReviewsQuery.error || tastingsQuery.error)) ? (
        <p role="status" {...stylex.props(styles.partialError)}>
          Some reviews, tastings, or recommendations could not be loaded. The
          rest of this page is still available.
        </p>
      ) : null}
    </>
  );
}

export function useBottlePage() {
  const bottle = useContext(BottlePageContext);
  if (!bottle) throw new Error("Bottle page content requires its route frame");
  return bottle;
}

const styles = stylex.create({
  page: {
    minWidth: 0,
    paddingBottom: { default: 0, [PHONE]: "76px" },
  },
  tabs: {
    marginTop: space.x6,
  },
  aliases: {
    marginTop: space.x4,
    marginBottom: 0,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.5,
  },
  aliasLabel: {
    color: colors.ink,
    fontWeight: 600,
  },
  description: {
    maxWidth: "680px",
    marginTop: space.x4,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.55,
  },
  overview: {
    minWidth: 0,
  },
  partialError: {
    margin: 0,
    marginTop: space.x6,
    padding: space.x4,
    backgroundColor: colors.surface,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.5,
  },
});
