"use client";

import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";

import { Button, ButtonLink } from "@peated/web/components/button.stylex";
import { EntityLinks } from "@peated/web/components/entityLinks";
import { ExpandableDescription } from "@peated/web/components/expandableDescription.stylex";
import type { FactListItem } from "@peated/web/components/factList.stylex";
import {
  EmptyState,
  LoadingList,
  SectionError,
} from "@peated/web/components/feedback.stylex";
import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import { BottleOverview } from "@peated/web/components/pages/bottleOverview.stylex";
import { BottlePageHeader } from "@peated/web/components/pages/bottlePageHeader.stylex";
import { BottleRailSection } from "@peated/web/components/pages/bottleRailSection.stylex";
import {
  PageTabs,
  type PageTabItem,
} from "@peated/web/components/pageTabs.stylex";
import {
  RowMenu,
  type RowMenuItem,
} from "@peated/web/components/rowMenu.stylex";
import { TextLink } from "@peated/web/components/textLink.stylex";
import { FlavorProfileSection } from "@peated/web/features/flavorProfile/flavorProfileSection";
import useAuth from "@peated/web/hooks/useAuth";
import {
  getAddBottleHref,
  getAddSimilarBottlePath,
} from "@peated/web/lib/addBottle";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { getBottleReleasePlacement } from "@peated/web/lib/bottleMetadata";
import { getReviewAndTastingFeedItems } from "@peated/web/lib/communityFeed";
import { logTelemetryError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { selectOtherSeriesBottles } from "@peated/web/lib/seriesBottleRail";
import {
  getBottleSeriesUrl,
  getBottleUrl,
  getEntityUrl,
} from "@peated/web/lib/urls";
import { colors, space } from "../../../../styles/tokens.stylex";

import { foundationStyles } from "../../../../styles/foundations.stylex";
import { bottleOverviewQueries } from "./bottleOverviewQueries";

type Bottle = Outputs["bottles"]["details"];

const BottlePageContext = createContext<Bottle | null>(null);

const PHONE = "@media (max-width: 480px)";

function getBottleDistillers(bottle: Bottle) {
  return bottle.distillers.length ? (
    <EntityLinks entities={bottle.distillers} />
  ) : null;
}

function getDeclaredFacts(bottle: Bottle): [FactListItem, ...FactListItem[]] {
  return [
    {
      label: "Series",
      value: bottle.series ? (
        <TextLink href={getBottleSeriesUrl(bottle.series)}>
          {bottle.series.name}
        </TextLink>
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
            ? "NAS"
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

function getTabs(bottle: Bottle): [PageTabItem, ...PageTabItem[]] {
  const baseUrl = getBottleUrl(bottle);
  const tabs: [PageTabItem, ...PageTabItem[]] = [
    { href: baseUrl, label: "Overview" },
    {
      count: bottle.publicReviewAndTastingCount,
      href: `${baseUrl}/tastings`,
      label: "Reviews & tastings",
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
                Rate this bottle
              </ButtonLink>
              <BottleLibraryAction bottle={bottle} />
            </>
          }
          brand={bottle.brand.shortName || bottle.brand.name}
          brandHref={getEntityUrl(bottle.brand)}
          metadata={getBottleDistillers(bottle)}
          menu={<BottleActions bottle={bottle} />}
          name={formatBottleDisplayName(bottle, { includeBrand: false })}
          rating={
            bottle.scoreCount === 0 &&
            !Object.values(bottle.tastingBandCounts).some((count) => count > 0)
              ? null
              : {
                  externalScoreCount: bottle.externalScoreCount,
                  memberScoreCount: bottle.memberScoreCount,
                  median: bottle.medianScore,
                  tastingCounts: bottle.tastingBandCounts,
                }
          }
        />
        {bottle.aliases.length ? (
          <p {...stylex.props(foundationStyles.body, styles.aliases)}>
            <span {...stylex.props(styles.aliasLabel)}>Also known as</span>{" "}
            {bottle.aliases.join(" · ")}
          </p>
        ) : null}
        {bottle.description ? (
          <div {...stylex.props(foundationStyles.body, styles.description)}>
            <ExpandableDescription content={bottle.description} />
          </div>
        ) : null}
        <div {...stylex.props(styles.tabs)}>
          <PageTabs
            ariaLabel="Bottle sections"
            currentHref={currentHref}
            items={getTabs(bottle)}
            prefetch
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
  const reviewsAndTastingsQuery = useQuery(
    bottleOverviewQueries.reviewsAndTastings(orpc, bottle.id),
  );
  const recommendationsQuery = useQuery(
    bottleOverviewQueries.recommendations(orpc, bottle.id),
  );
  const seriesBottlesQuery = useQuery(
    bottleOverviewQueries.series(orpc, bottle.series?.id),
  );

  const reviewsAndTastings = getReviewAndTastingFeedItems(
    reviewsAndTastingsQuery.data?.results ?? [],
  );
  const recommendations =
    recommendationsQuery.data?.results.map((recommendation) =>
      toBottleListItem(recommendation, { includeRatings: true }),
    ) ?? [];
  const otherSeriesBottles = seriesBottlesQuery.data
    ? selectOtherSeriesBottles(seriesBottlesQuery.data.results, bottle.id).map(
        (seriesBottle) => toBottleListItem(seriesBottle),
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
    !reviewsAndTastings.length && reviewsAndTastingsQuery.isPending;
  const mainFailed =
    !reviewsAndTastings.length &&
    !mainPending &&
    Boolean(reviewsAndTastingsQuery.error);
  const mainState = mainPending ? (
    <LoadingList label="Loading bottle reviews and tastings" rows={3} />
  ) : mainFailed ? (
    <SectionError
      heading="Reviews and tastings are unavailable"
      onRetry={() => {
        void reviewsAndTastingsQuery.refetch();
      }}
    >
      We could not load this bottle's reviews or tastings. Try again.
    </SectionError>
  ) : !reviewsAndTastings.length ? (
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
      This bottle has no reviews or tastings yet.
    </EmptyState>
  ) : null;

  return (
    <>
      <BottleOverview
        declaredFacts={getDeclaredFacts(bottle)}
        image={{
          label: formatBottleDisplayName(bottle),
          license: bottle.imageLicense,
          sourceUrl: bottle.imageSourceUrl,
          url: bottle.imageUrl,
        }}
        mainState={mainState}
        moreReviewsAndTastingsHref={`${getBottleUrl(bottle)}/tastings`}
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
        reviewAndTastingCount={bottle.publicReviewAndTastingCount}
        reviewsAndTastings={reviewsAndTastings}
      />

      {recommendationsQuery.error ||
      (!mainFailed && reviewsAndTastingsQuery.error) ? (
        <p
          role="status"
          {...stylex.props(foundationStyles.metadata, styles.partialError)}
        >
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
  },
  aliasLabel: {
    color: colors.ink,
    fontWeight: 600,
  },
  description: {
    maxWidth: "680px",
    marginTop: space.x4,
    color: colors.inkMuted,
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
  },
});
