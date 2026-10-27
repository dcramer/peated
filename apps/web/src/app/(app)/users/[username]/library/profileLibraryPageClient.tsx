"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Button, ButtonLink } from "@peated/web/components/button.stylex";
import {
  EmptyState,
  SectionError,
} from "@peated/web/components/feedback.stylex";
import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import { LibraryList } from "@peated/web/components/libraryList.stylex";
import { LibraryTable } from "@peated/web/components/libraryTable.stylex";
import { ListControls } from "@peated/web/components/listControls.stylex";
import { CursorPager, ListToolbar } from "@peated/web/components/lists.stylex";
import {
  MemberListFilterGroups,
  MemberListFilters,
  type MemberListFilterGroup,
} from "@peated/web/components/pages/memberListFilters.stylex";
import type { RowMenuGroup } from "@peated/web/components/rowMenu.stylex";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import {
  getLibraryItem,
  type LibraryEntry,
} from "@peated/web/lib/libraryItems";
import { useORPC } from "@peated/web/lib/orpc/context";
import { ProfileBottleSearch } from "../profileBottleSearch.stylex";
import { useProfile } from "../profileContext";
import {
  getAgeFilterGroup,
  getEntityCountGroup,
  useEntityFilterGroup,
  useProfileListParams,
} from "../profileListFilters";
import {
  countProfileLibraryFilters,
  getProfileLibraryInput,
  getProfileListView,
  profileQueries,
} from "../profileQueries";
import {
  ProfileLibraryFiltersLoading,
  ProfileLibraryLayout,
  ProfileLibraryResultsLoading,
} from "./profileLibraryLayout";

type LibraryList = Outputs["collections"]["bottles"]["list"];
type LibraryStats = Outputs["users"]["libraryStats"];

const sortOptions = [
  { label: "Alphabetical", value: "name" },
  { label: "Recently added", value: "-created" },
] as const;

// Filters a member can clear at once; `sort` and `view` are display choices.
const FILTER_PARAMS = [
  "age",
  "brand",
  "distiller",
  "entity",
  "query",
  "status",
];

export function ProfileLibraryPageClient() {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { flash } = useFlashMessages();
  const { isCurrentUser, user } = useProfile();
  const {
    clearFilters,
    displayed,
    isNavigating,
    pathname,
    searchParams,
    setParam,
  } = useProfileListParams(FILTER_PARAMS);
  const input = getProfileLibraryInput(searchParams, user.id);
  const displayedInput = getProfileLibraryInput(displayed, user.id);
  // The Filters button follows the controls; empty states follow the results
  // on screen, which come from the committed URL.
  const activeFilterCount = countProfileLibraryFilters(displayedInput);
  const resultsFiltered = countProfileLibraryFilters(input) > 0;
  const view = getProfileListView(displayed);
  const libraryQuery = useQuery(profileQueries.library(orpc, input));
  const statsQuery = useQuery(profileQueries.libraryStats(orpc, user.id));
  const entityGroup = useEntityFilterGroup(displayedInput.entity);
  const updateMutation = useMutation(
    orpc.collections.bottles.update.mutationOptions(),
  );
  const deleteMutation = useMutation(
    orpc.collections.bottles.delete.mutationOptions(),
  );
  const mutationPending = updateMutation.isPending || deleteMutation.isPending;
  const filters = [
    ...(entityGroup ? [entityGroup] : []),
    ...getFilterGroups({ params: displayed, stats: statsQuery.data }),
  ];

  // The app's query client refetches every query after a mutation, including
  // the list total and the rail counts; this shows the change until then.
  function updateLibraryList(change: (current: LibraryList) => LibraryList) {
    queryClient.setQueriesData<LibraryList>(
      { queryKey: orpc.collections.bottles.list.key({ type: "query" }) },
      (current) => (current ? change(current) : current),
    );
  }

  async function updateStatus(
    entry: LibraryEntry,
    status: LibraryEntry["status"],
  ) {
    try {
      const updated = await updateMutation.mutateAsync({
        collection: "library",
        collectionBottle: entry.id,
        status,
        user: "me",
      });
      updateLibraryList((current) => ({
        ...current,
        results: current.results.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      }));
    } catch {
      flash("We couldn't change this bottle's status. Try again.", "error");
    }
  }

  async function removeEntry(entry: LibraryEntry) {
    try {
      await deleteMutation.mutateAsync({
        bottle: entry.bottle.id,
        collection: "library",
        user: "me",
      });
      // Other cached pages and filters may not hold this bottle; leave their
      // totals alone.
      updateLibraryList((current) =>
        current.results.some((item) => item.id === entry.id)
          ? {
              ...current,
              results: current.results.filter((item) => item.id !== entry.id),
              total: current.total - 1,
            }
          : current,
      );
      // The tab badge and "In library" come from the server-rendered profile,
      // which query invalidation does not reach.
      router.refresh();
    } catch {
      flash(
        "We couldn't remove this bottle from your Library. Try again.",
        "error",
      );
    }
  }

  function getActions(entry: LibraryEntry): RowMenuGroup[] | undefined {
    if (!isCurrentUser) return undefined;
    return [
      {
        items: [
          {
            href: `/bottles/${entry.bottle.id}/addTasting`,
            label: "Rate this bottle",
          },
        ],
      },
      {
        label: "Bottle status",
        items: [
          ...(["open", "sealed", "empty"] as const).map((status) => ({
            disabled: mutationPending,
            label: `Mark as ${status}`,
            onSelect: () => void updateStatus(entry, status),
          })),
          {
            disabled: mutationPending,
            label: "Clear status",
            onSelect: () => void updateStatus(entry, null),
          },
        ],
      },
      {
        items: [
          {
            disabled: mutationPending,
            label: "Remove from library",
            onSelect: () => void removeEntry(entry),
          },
        ],
      },
    ];
  }

  const search = (
    <ProfileBottleSearch
      // One brand or producer filter replaces the search text and the rail
      // filters it overlaps.
      onEntitySelect={(entityId) =>
        setParam("entity", String(entityId), ["brand", "distiller", "query"])
      }
      onSubmit={(value) => setParam("query", value)}
      query={displayedInput.query}
      scope="library"
      userId={user.id}
    />
  );
  const groupProps = {
    groups: filters,
    onChange: setParam,
    total: statsQuery.data?.total,
  };
  const items = (libraryQuery.data?.results ?? []).map((entry) =>
    getLibraryItem(entry, getActions(entry)),
  );
  const pending = isNavigating || libraryQuery.isFetching;

  return (
    <ProfileLibraryLayout
      rail={
        // Counts come from the server render; keep the rail's shape until they do.
        statsQuery.isPending ? (
          <ProfileLibraryFiltersLoading />
        ) : (
          <MemberListFilters
            {...groupProps}
            onClear={clearFilters}
            query={displayedInput.query}
            search={search}
          />
        )
      }
    >
      <section aria-label={`${user.username}'s library`}>
        {/* Without data the toolbar would read "0 bottles"; reserve it instead. */}
        {libraryQuery.isPending ? (
          <ProfileLibraryResultsLoading view={view} />
        ) : libraryQuery.data ? (
          <ListToolbar
            count={items.length}
            mobileAction={
              <ListControls
                activeFilterCount={activeFilterCount}
                filters={<MemberListFilterGroups {...groupProps} />}
                onClear={clearFilters}
                onSortChange={(value) => setParam("sort", value)}
                pluralNoun="bottles"
                search={search}
                sort={displayedInput.sort}
                sortOptions={sortOptions}
              />
            }
            noun="bottle"
            onSortChange={(value) => setParam("sort", value)}
            onViewChange={(value) =>
              setParam("view", value === "table" ? value : "")
            }
            pending={pending}
            sort={displayedInput.sort}
            sortOptions={sortOptions}
            total={libraryQuery.data.total}
            view={view}
          />
        ) : null}
        <div aria-busy={pending || mutationPending || undefined}>
          {libraryQuery.isPending ? null : libraryQuery.error ? (
            <SectionError
              heading="Library is unavailable"
              onRetry={() => void libraryQuery.refetch()}
            >
              The profile is still available. Try loading{" "}
              {isCurrentUser ? "your" : "their"} Library again.
            </SectionError>
          ) : !items.length && input.cursor > 1 ? (
            // A page past the end, such as after removing its last row or
            // from an old link, is not an empty list.
            <EmptyState
              action={
                <ButtonLink
                  href={getCursorHref(pathname, searchParams, 1)}
                  size="sm"
                >
                  Go to the first page
                </ButtonLink>
              }
              heading="No bottles on this page"
            >
              This page is past the end of the list.
            </EmptyState>
          ) : !items.length ? (
            resultsFiltered ? (
              <EmptyState
                action={
                  <Button onClick={clearFilters} size="sm" variant="text">
                    Clear filters
                  </Button>
                }
                heading="No matching bottles"
              >
                No Library bottles match these filters.
              </EmptyState>
            ) : (
              <EmptyState
                action={
                  isCurrentUser ? (
                    <ButtonLink
                      href="/addBottle?intent=library"
                      size="sm"
                      variant="accent"
                    >
                      Add your first bottle
                    </ButtonLink>
                  ) : undefined
                }
                heading="No library bottles yet"
              >
                {isCurrentUser
                  ? "Track what you own, what you have finished, and what you want to open next."
                  : `${user.username} has not added any bottles to their Library.`}
              </EmptyState>
            )
          ) : view === "table" ? (
            <LibraryTable
              caption={`${user.username}'s library`}
              items={items}
            />
          ) : (
            <LibraryList
              ariaLabel={`${user.username}'s library`}
              items={items}
            />
          )}
        </div>
        <CursorPager
          ariaLabel={`${user.username} library pages`}
          nextHref={getCursorHref(
            pathname,
            searchParams,
            libraryQuery.data?.rel.nextCursor,
          )}
          page={input.cursor}
          previousHref={getCursorHref(
            pathname,
            searchParams,
            libraryQuery.data?.rel.prevCursor,
          )}
        />
      </section>
    </ProfileLibraryLayout>
  );
}

function getFilterGroups({
  params,
  stats,
}: {
  params: URLSearchParams;
  stats?: LibraryStats;
}): MemberListFilterGroup[] {
  // An empty Library has nothing to filter.
  if (!stats?.total) return [];
  const status = params.get("status");
  const groups: MemberListFilterGroup[] = [
    {
      filters: [
        { count: stats.status.open, label: "Open", value: "open" },
        { count: stats.status.sealed, label: "Sealed", value: "sealed" },
        { count: stats.status.empty, label: "Empty", value: "empty" },
        { count: stats.status.unspecified, label: "Not set", value: "unset" },
      ].map((filter) => ({ ...filter, selected: status === filter.value })),
      label: "Status",
      name: "status",
    },
    getAgeFilterGroup(stats.age, params.get("age")),
  ];

  if (stats.brands.length) {
    groups.push(
      getEntityCountGroup({
        items: stats.brands,
        label: "Brands",
        name: "brand",
        selected: params.get("brand"),
      }),
    );
  }

  if (stats.distillers.length) {
    groups.push(
      getEntityCountGroup({
        items: stats.distillers,
        label: "Distilleries",
        name: "distiller",
        selected: params.get("distiller"),
      }),
    );
  }

  return groups;
}
