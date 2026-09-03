"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { ButtonLink, LoadingList, SectionError } from "@peated/web/components";
import {
  MemberLibraryFilters,
  MemberLibraryList,
  type MemberLibraryFilterGroup,
  type MemberLibraryItem,
} from "@peated/web/components/pages/memberProfileContent.stylex";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { foundationStyles } from "../../../../../styles/foundations.stylex";
import { colors, space } from "../../../../../styles/tokens.stylex";
import { useProfile } from "../profileContext";
import { getProfileLibraryInput, profileQueries } from "../profileQueries";
import { ProfileLibraryLayout } from "./profileLibraryLayout.stylex";

type LibraryEntry =
  Outputs["collections"]["bottles"]["list"]["results"][number];
type LibraryEntryChange = LibraryEntry["status"] | "removed";

const sortOptions = [
  { label: "Alphabetical", value: "name" },
  { label: "Recently added", value: "-created" },
] as const;

export function ProfileLibraryPageClient() {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isCurrentUser, user } = useProfile();
  const [isNavigating, startTransition] = useTransition();
  const [entryChanges, setEntryChanges] = useState<
    Record<number, LibraryEntryChange>
  >({});
  const [mutationError, setMutationError] = useState(false);
  const input = getProfileLibraryInput(searchParams, user.id);
  const { brand, cursor, distiller, query, sort, status } = input;
  const libraryQueryOptions = profileQueries.library(orpc, input);
  const libraryListQueryKey = orpc.collections.bottles.list.key({
    type: "query",
  });
  const libraryQuery = useQuery(libraryQueryOptions);
  const statsQuery = useQuery(profileQueries.libraryStats(orpc, user.id));
  const updateMutation = useMutation(
    orpc.collections.bottles.update.mutationOptions(),
  );
  const deleteMutation = useMutation(
    orpc.collections.bottles.delete.mutationOptions(),
  );
  const mutationPending = updateMutation.isPending || deleteMutation.isPending;
  const filters = getFilterGroups({
    brand,
    distiller,
    stats: statsQuery.data,
    status: status ?? "",
  });

  function navigate(nextParams: URLSearchParams) {
    const nextQuery = nextParams.toString();
    startTransition(() =>
      router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname),
    );
  }

  function setFilter(
    name: "brand" | "distiller" | "status" | "sort",
    value: string,
  ) {
    const next = new URLSearchParams(searchParams);
    next.delete("cursor");
    if (value) next.set(name, value);
    else next.delete(name);
    navigate(next);
  }

  function setQuery(value: string) {
    const next = new URLSearchParams(searchParams);
    next.delete("cursor");
    if (value) next.set("query", value);
    else next.delete("query");
    navigate(next);
  }

  function clearFilters() {
    const next = new URLSearchParams(searchParams);
    ["brand", "cursor", "distiller", "query", "status"].forEach((name) =>
      next.delete(name),
    );
    navigate(next);
  }

  async function refreshLibraryStats() {
    await queryClient.invalidateQueries({
      queryKey: orpc.users.libraryStats.key({ type: "query" }),
    });
  }

  async function updateStatus(
    entry: LibraryEntry,
    nextStatus: LibraryEntry["status"],
  ) {
    setMutationError(false);
    try {
      const updatedEntry = await updateMutation.mutateAsync({
        collection: "library",
        collectionBottle: entry.id,
        status: nextStatus,
        user: "me",
      });
      queryClient.setQueriesData<Outputs["collections"]["bottles"]["list"]>(
        { queryKey: libraryListQueryKey },
        (current) =>
          current
            ? {
                ...current,
                results: current.results.map((item) =>
                  item.id === updatedEntry.id ? updatedEntry : item,
                ),
              }
            : current,
      );
      setEntryChanges((current) => ({
        ...current,
        [entry.id]: nextStatus,
      }));
      await refreshLibraryStats();
    } catch {
      setMutationError(true);
    }
  }

  async function removeEntry(entry: LibraryEntry) {
    setMutationError(false);
    try {
      await deleteMutation.mutateAsync({
        bottle: entry.bottle.id,
        collection: "library",
        user: "me",
      });
      queryClient.setQueriesData<Outputs["collections"]["bottles"]["list"]>(
        { queryKey: libraryListQueryKey },
        (current) =>
          current
            ? {
                ...current,
                results: current.results.filter((item) => item.id !== entry.id),
              }
            : current,
      );
      setEntryChanges((current) => ({
        ...current,
        [entry.id]: "removed",
      }));
      await refreshLibraryStats();
    } catch {
      setMutationError(true);
    }
  }

  const filterPanel = (
    <MemberLibraryFilters
      groups={filters}
      mode="rail"
      onChange={setFilter}
      onClear={clearFilters}
      onQuerySubmit={setQuery}
      query={query}
      total={statsQuery.data?.total}
    />
  );

  return (
    <ProfileLibraryLayout
      mobileFilters={
        <MemberLibraryFilters
          groups={filters}
          mode="mobile"
          onChange={setFilter}
          onClear={clearFilters}
          onQuerySubmit={setQuery}
          query={query}
          total={statsQuery.data?.total}
        />
      }
      rail={filterPanel}
    >
      <div aria-busy={isNavigating || mutationPending || undefined}>
        {mutationError ? (
          <p
            role="alert"
            {...stylex.props(foundationStyles.metadata, styles.actionError)}
          >
            The library change failed. Try the action again.
          </p>
        ) : null}
        {libraryQuery.isPending ? (
          <LoadingList label="Loading member library" rows={4} />
        ) : libraryQuery.error ? (
          <SectionError
            heading="Library is unavailable"
            onRetry={() => void libraryQuery.refetch()}
          >
            The member profile is still available. Try loading the Library
            again.
          </SectionError>
        ) : (
          <MemberLibraryList
            emptyAction={
              isCurrentUser &&
              !hasActiveFilters({ brand, distiller, query, status }) ? (
                <ButtonLink
                  href="/addBottle?intent=library"
                  size="sm"
                  variant="accent"
                >
                  Add your first bottle
                </ButtonLink>
              ) : undefined
            }
            emptyDescription={
              hasActiveFilters({ brand, distiller, query, status })
                ? "No library bottles match these filters."
                : isCurrentUser
                  ? "Track what you own, what you have finished, and what you want to open next."
                  : `${user.username} has not added any bottles to their Library.`
            }
            emptyHeading={
              hasActiveFilters({ brand, distiller, query, status })
                ? "No matching bottles"
                : "No library bottles yet"
            }
            items={applyEntryChanges(
              libraryQuery.data.results,
              entryChanges,
            ).map((entry) =>
              toLibraryItem(
                entry,
                isCurrentUser,
                mutationPending,
                updateStatus,
                removeEntry,
              ),
            )}
            nextHref={getCursorHref(
              pathname,
              searchParams,
              libraryQuery.data.rel.nextCursor,
            )}
            page={cursor}
            onSortChange={(value) => setFilter("sort", value)}
            previousHref={getCursorHref(
              pathname,
              searchParams,
              libraryQuery.data.rel.prevCursor,
            )}
            total={statsQuery.data?.total}
            sort={sort}
            sortOptions={sortOptions}
          />
        )}
      </div>
    </ProfileLibraryLayout>
  );
}

function applyEntryChanges(
  entries: readonly LibraryEntry[],
  changes: Record<number, LibraryEntryChange>,
) {
  return entries.flatMap((entry) => {
    if (!Object.hasOwn(changes, entry.id)) return [entry];
    const change = changes[entry.id];
    return change === "removed" ? [] : [{ ...entry, status: change }];
  });
}

function toLibraryItem(
  entry: LibraryEntry,
  canEdit: boolean,
  disabled: boolean,
  updateStatus: (
    entry: LibraryEntry,
    status: LibraryEntry["status"],
  ) => Promise<void>,
  removeEntry: (entry: LibraryEntry) => Promise<void>,
): MemberLibraryItem {
  const bottle = entry.bottle;
  return {
    ...toBottleListItem(bottle),
    hasTasted: false,
    isLibrary: false,
    actions: canEdit
      ? [
          {
            items: [
              {
                href: `/bottles/${bottle.id}/addTasting`,
                label: "Rate this bottle",
              },
            ],
          },
          {
            label: "Bottle status",
            items: [
              ...(["open", "sealed", "empty"] as const).map((status) => ({
                disabled,
                label: `Mark as ${status}`,
                onSelect: () => void updateStatus(entry, status),
              })),
              {
                disabled,
                label: "Clear status",
                onSelect: () => void updateStatus(entry, null),
              },
            ],
          },
          {
            items: [
              {
                disabled,
                label: "Remove from library",
                onSelect: () => void removeEntry(entry),
              },
            ],
          },
        ]
      : undefined,
    id: String(entry.id),
    imageUrl: entry.imageUrl ?? bottle.imageUrl,
    status: entry.status ? capitalize(entry.status) : undefined,
  };
}

function getFilterGroups({
  brand,
  distiller,
  stats,
  status,
}: {
  brand?: number;
  distiller?: number;
  stats?: Outputs["users"]["libraryStats"];
  status: string;
}): MemberLibraryFilterGroup[] {
  const total = stats?.total ?? 0;
  const groups: MemberLibraryFilterGroup[] = [
    {
      filters: [
        {
          count: stats?.status.open,
          label: "Open",
          selected: status === "open",
          value: "open",
        },
        {
          count: stats?.status.sealed,
          label: "Sealed",
          selected: status === "sealed",
          value: "sealed",
        },
        { label: "Empty", selected: status === "empty", value: "empty" },
        {
          count: stats?.status.unspecified,
          label: "Not set",
          selected: status === "unset",
          value: "unset",
        },
      ],
      label: "Status",
      name: "status",
    },
    {
      filters: (stats?.brands ?? []).map((item) => ({
        count: item.count,
        label: item.name,
        selected: brand === item.id,
        value: String(item.id),
      })),
      label: "Brands",
      name: "brand",
    },
    {
      filters: (stats?.distillers ?? []).map((item) => ({
        count: item.count,
        label: item.name,
        selected: distiller === item.id,
        value: String(item.id),
      })),
      label: "Distilleries",
      name: "distiller",
    },
  ];
  return groups.filter(
    (group) => group.name === "status" || group.filters.length || total === 0,
  );
}

function hasActiveFilters(values: {
  brand?: number;
  distiller?: number;
  query: string;
  status?: string;
}) {
  return Boolean(
    values.brand || values.distiller || values.query || values.status,
  );
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

const styles = stylex.create({
  actionError: {
    marginTop: 0,
    marginBottom: space.x4,
    padding: space.x3,
    borderRadius: "3px",
    backgroundColor: colors.accentTint,
    color: colors.accentDeep,
  },
});
