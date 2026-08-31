"use client";

import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import {
  formatCategoryName,
  formatServingStyle,
} from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";

import {
  BottleRatings,
  Button,
  ButtonLink,
  EmptyState,
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
import Join from "@peated/web/components/join";
import { BottleOverview } from "@peated/web/components/pages/bottleOverview.stylex";
import { BottlePageHeader } from "@peated/web/components/pages/bottlePageHeader.stylex";
import TimeSince from "@peated/web/components/timeSince";
import useAuth from "@peated/web/hooks/useAuth";
import {
  getAddBottleHref,
  getAddSimilarBottlePath,
} from "@peated/web/lib/addBottle";
import { getBottleReleasePlacement } from "@peated/web/lib/bottleMetadata";
import { logTelemetryError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { getEntityUrl } from "@peated/web/lib/urls";
import { colors, fonts, space } from "../../../../styles/tokens.stylex";

type Bottle = Outputs["bottles"]["details"];
type RecommendationList = Outputs["bottles"]["recommendations"];
type ExternalReviewList = Outputs["externalReviews"]["list"];
type TastingList = Outputs["tastings"]["list"];
type ExternalReview = Outputs["externalReviews"]["list"]["results"][number];
type Tasting = Outputs["tastings"]["list"]["results"][number];

const BottlePageContext = createContext<Bottle | null>(null);

const PHONE = "@media (max-width: 480px)";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function getBottleDetail(bottle: Bottle) {
  return (
    <Join divider=" · ">
      {[
        bottle.category ? formatCategoryName(bottle.category) : null,
        bottle.distillers.length ? (
          <EntityLinks entities={bottle.distillers} key="distillers" />
        ) : null,
        bottle.bottler ? (
          <EntityLinks entities={[bottle.bottler]} key="bottler" />
        ) : null,
      ].filter((value) => value !== null)}
    </Join>
  );
}

function getBottleNotes(bottle: Bottle) {
  return [
    bottle.caskStrength ? "Cask strength" : null,
    bottle.singleCask ? "Single cask" : null,
  ].filter((value): value is string => value !== null);
}

function getDeclaredFacts(bottle: Bottle): [FactListItem, ...FactListItem[]] {
  return [
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
  };
}

function getTasting(tasting: Tasting, bottle: Bottle): TastingEntryProps {
  const member = {
    description: tasting.notes ?? undefined,
    descriptionHref: `/tastings/${tasting.id}`,
    name: formatBottleDisplayName(bottle, { includeBrand: false }),
    notes: tasting.tags,
    ratingBand: tasting.ratingBand ?? undefined,
  };

  return {
    author: tasting.createdBy.username,
    authorHref: `/users/${tasting.createdBy.username}`,
    context: tasting.servingStyle
      ? formatServingStyle(tasting.servingStyle)
      : undefined,
    date: <TimeSince date={tasting.createdAt} />,
    members: [member],
  };
}

function getTabs(bottle: Bottle): [PageTabItem, ...PageTabItem[]] {
  const baseUrl = `/bottles/${bottle.id}`;
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
  const { user } = useAuth();
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
    pathname === `/${bottle.peatedId}` ? `/bottles/${bottle.id}` : pathname;

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
          brandHref={getEntityUrl({ id: bottle.brand.id, kind: "brand" })}
          detail={getBottleDetail(bottle)}
          id={bottle.peatedId}
          imageUrl={bottle.imageUrl}
          imageSourceUrl={bottle.imageSourceUrl}
          imageLicense={bottle.imageLicense}
          memberStatus={
            user
              ? {
                  hasTasted: bottle.hasTasted,
                  isLibrary: bottle.isLibrary,
                }
              : undefined
          }
          menu={<BottleActions bottle={bottle} />}
          name={formatBottleDisplayName(bottle, { includeBrand: false })}
          notes={getBottleNotes(bottle)}
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

export function BottleOverviewClient({
  initialRecommendations,
  initialReviews,
  initialTastings,
}: {
  initialRecommendations?: RecommendationList;
  initialReviews?: ExternalReviewList;
  initialTastings?: TastingList;
}) {
  const orpc = useORPC();
  const bottle = useBottlePage();
  const externalReviewsQuery = useQuery({
    ...orpc.externalReviews.list.queryOptions({
      input: { bottle: bottle.id, limit: 3, sort: "recent" },
    }),
    initialData: initialReviews,
  });
  const tastingsQuery = useQuery({
    ...orpc.tastings.list.queryOptions({
      input: { bottle: bottle.id, limit: 3 },
    }),
    initialData: initialTastings,
  });
  const recommendationsQuery = useQuery({
    ...orpc.bottles.recommendations.queryOptions({
      input: { bottle: bottle.id, limit: 3 },
    }),
    initialData: initialRecommendations,
  });

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
      href: `/bottles/${recommendation.id}`,
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
        mainState={mainState}
        moreTastingsHref={`/bottles/${bottle.id}/tastings`}
        recommendationIntro={recommendationsQuery.data?.reason}
        recommendations={recommendations}
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
  overview: {
    marginTop: space.x8,
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
