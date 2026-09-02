"use client";

import type { BOTTLE_LIST_SORT_OPTIONS } from "@peated/server/constants";
import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  BottleRatings,
  FactList,
  RowMenu,
  SectionError,
  TextLink,
  type RowMenuItem,
} from "@peated/web/components";
import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import Markdown from "@peated/web/components/markdown";
import { BottleCatalogList } from "@peated/web/components/pages/bottleCatalog.stylex";
import {
  PageColumns,
  PageHeader,
} from "@peated/web/components/pages/pageLayout.stylex";
import useAuth from "@peated/web/hooks/useAuth";
import { getAddBottleHref } from "@peated/web/lib/addBottle";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { buildSearchHref, getCursorHref } from "@peated/web/lib/cursorHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { getEntityUrl } from "@peated/web/lib/urls";
import { space } from "../../../../styles/tokens.stylex";

const COMPACT = "@media (max-width: 639px)";

type BottleList = Outputs["bottles"]["list"];
type Bottle = BottleList["results"][number];
type Series = Outputs["bottleSeries"]["details"];
type BottleSort = (typeof BOTTLE_LIST_SORT_OPTIONS)[number];

const sortOptions = [
  { label: "Latest release", value: "-release" },
  { label: "Most tasted", value: "-tastings" },
  { label: "Highest score", value: "-score" },
  { label: "Bottle name", value: "name" },
  { label: "Oldest age", value: "-age" },
  { label: "Recently added", value: "-created" },
] as const;

export function getSeriesBottleActionGroups({
  bottle,
  isLibrary,
  isLoggedIn,
  libraryMutationPending,
  onLibraryToggle,
  thisBottlePending,
}: {
  bottle: Pick<Bottle, "id">;
  isLibrary: boolean;
  isLoggedIn: boolean;
  libraryMutationPending: boolean;
  onLibraryToggle: () => void;
  thisBottlePending: boolean;
}): RowMenuItem[][] {
  const libraryAction: RowMenuItem = isLoggedIn
    ? {
        disabled: libraryMutationPending,
        label: thisBottlePending
          ? isLibrary
            ? "Removing from Library…"
            : "Adding to Library…"
          : isLibrary
            ? "Remove from Library"
            : "Add to Library",
        onSelect: onLibraryToggle,
      }
    : {
        href: getAddBottleHref({
          bottleId: bottle.id,
          intent: "library",
        }),
        label: "Add to Library",
      };

  return [
    [
      {
        href: getAddBottleHref({
          bottleId: bottle.id,
          intent: "tasting",
        }),
        label: "Log a tasting",
      },
    ],
    [libraryAction],
  ];
}

export function SeriesPageClient({
  initialBottleList,
  initialCursor,
  initialSeries,
  initialSort,
}: {
  initialBottleList: BottleList;
  initialCursor: number;
  initialSeries: Series;
  initialSort: BottleSort;
}) {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { flash } = useFlashMessages();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [libraryOverrides, setLibraryOverrides] = useState<
    Record<number, boolean>
  >({});
  const [pendingLibraryBottleId, setPendingLibraryBottleId] = useState<
    number | null
  >(null);
  const addLibraryMutation = useMutation(
    orpc.collections.bottles.create.mutationOptions(),
  );
  const removeLibraryMutation = useMutation(
    orpc.collections.bottles.delete.mutationOptions(),
  );
  const libraryMutationPending =
    addLibraryMutation.isPending || removeLibraryMutation.isPending;
  const bottleListQuery = useQuery({
    ...orpc.bottles.list.queryOptions({
      input: {
        cursor: initialCursor,
        limit: 25,
        series: initialSeries.id,
        sort: initialSort,
      },
    }),
    initialData: initialBottleList,
  });

  async function toggleLibrary(bottle: Bottle, isLibrary: boolean) {
    if (!user || pendingLibraryBottleId !== null) return;

    setPendingLibraryBottleId(bottle.id);
    try {
      if (isLibrary) {
        await removeLibraryMutation.mutateAsync({
          bottle: bottle.id,
          collection: "library",
          user: "me",
        });
      } else {
        await addLibraryMutation.mutateAsync({
          bottle: bottle.id,
          collection: "library",
          user: "me",
        });
      }

      setLibraryOverrides((current) => ({
        ...current,
        [bottle.id]: !isLibrary,
      }));
      flash(
        isLibrary ? "Removed from your Library." : "Added to your Library.",
      );
      void queryClient.invalidateQueries({
        queryKey: orpc.bottles.list.key({ type: "query" }),
      });
      void queryClient.invalidateQueries({
        queryKey: orpc.collections.bottles.list.key({ type: "query" }),
      });
      void queryClient.invalidateQueries({
        queryKey: orpc.users.libraryStats.key({ type: "query" }),
      });
    } catch {
      flash(
        isLibrary
          ? "We couldn't remove this bottle from your Library. Try again."
          : "We couldn't add this bottle to your Library. Try again.",
        "error",
      );
    } finally {
      setPendingLibraryBottleId(null);
    }
  }

  function updateSort(value: string) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("sort", value);
    nextParams.delete("cursor");
    router.push(buildSearchHref(pathname, nextParams));
  }

  const facts = [
    { label: "Series ID", value: initialSeries.peatedId },
    {
      label: "Bottles",
      value: initialBottleList.total.toLocaleString("en-US"),
    },
  ] as const;
  const bottleList = bottleListQuery.data;

  return (
    <div {...stylex.props(styles.page)}>
      <PageHeader
        description={
          initialSeries.description ? (
            <Markdown content={initialSeries.description} />
          ) : undefined
        }
        eyebrow="Whisky series"
        parent={
          <TextLink href={getEntityUrl(initialSeries.brand)}>
            {initialSeries.brand.name}
          </TextLink>
        }
        title={initialSeries.name}
      />
      <PageColumns rail={<FactList facts={facts} />} railBehavior="stack">
        <div {...stylex.props(styles.bottles)}>
          {bottleListQuery.error ? (
            <SectionError
              heading="Bottles in this series are unavailable"
              onRetry={() => void bottleListQuery.refetch()}
            >
              The series page still works. Try loading the bottles again.
            </SectionError>
          ) : bottleList ? (
            <BottleCatalogList
              emptyDescription={`No bottles have been added to ${initialSeries.fullName} yet.`}
              emptyHeading="No bottles in this series yet"
              items={bottleList.results.map((bottle) => {
                const item = toBottleListItem(bottle, {
                  includeBrandInName: false,
                  includeBrandRow: false,
                  includeRatings: true,
                  includeRelatedReleases: true,
                  includeSeriesInName: false,
                });
                const isLibrary =
                  libraryOverrides[bottle.id] ?? bottle.isLibrary;

                return {
                  ...item,
                  end: (
                    <div {...stylex.props(styles.rowEnd)}>
                      {item.ratings ? (
                        <BottleRatings {...item.ratings} />
                      ) : null}
                      <span {...stylex.props(styles.desktopActions)}>
                        <RowMenu
                          groups={getSeriesBottleActionGroups({
                            bottle,
                            isLibrary,
                            isLoggedIn: Boolean(user),
                            libraryMutationPending,
                            onLibraryToggle: () =>
                              void toggleLibrary(bottle, isLibrary),
                            thisBottlePending:
                              pendingLibraryBottleId === bottle.id,
                          })}
                          label={formatBottleDisplayName(bottle, {
                            includeBrand: false,
                            includeSeries: false,
                          })}
                          triggerVariant="text"
                        />
                      </span>
                    </div>
                  ),
                  isLibrary,
                  ratings: undefined,
                };
              })}
              nextHref={getCursorHref(
                pathname,
                searchParams,
                bottleList.rel.nextCursor,
              )}
              onSortChange={updateSort}
              page={initialCursor}
              previousHref={getCursorHref(
                pathname,
                searchParams,
                bottleList.rel.prevCursor,
              )}
              sort={initialSort}
              sortOptions={sortOptions}
              total={bottleList.total}
            />
          ) : null}
        </div>
      </PageColumns>
    </div>
  );
}

const styles = stylex.create({
  page: {
    minWidth: 0,
  },
  bottles: {
    minWidth: 0,
    paddingTop: space.x4,
  },
  rowEnd: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
  },
  desktopActions: {
    display: "inline-flex",
    [COMPACT]: {
      display: "none",
    },
  },
});
