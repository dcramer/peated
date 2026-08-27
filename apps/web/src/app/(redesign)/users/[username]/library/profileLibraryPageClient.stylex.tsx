"use client";

import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import {
  ButtonLink,
  LoadingRecordList,
  ModuleError,
} from "@peated/web/components/designSystem/components";
import {
  MemberLibraryFilters,
  MemberLibraryList,
  type MemberLibraryFilterGroup,
  type MemberLibraryItem,
} from "@peated/web/components/designSystem/patterns/memberProfileContent.stylex";
import { PageColumns } from "@peated/web/components/designSystem/patterns/pagePatternShell.stylex";
import { getBottleExpressionName } from "@peated/web/lib/bottleLabel";
import { useORPC } from "@peated/web/lib/orpc/context";
import { colors, fonts, space } from "../../../../../styles/tokens.stylex";
import { useProfile } from "../profileContext";

type LibraryEntry =
  Outputs["collections"]["bottles"]["list"]["results"][number];
type LibraryStatus = NonNullable<LibraryEntry["status"]>;
type LibraryEntryChange = LibraryEntry["status"] | "removed";
const statusValues = new Set(["open", "sealed", "empty", "unset"]);

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
  const cursor = Number(searchParams.get("cursor") ?? "1") || 1;
  const query = searchParams.get("query") ?? "";
  const brand = positiveNumber(searchParams.get("brand"));
  const distiller = positiveNumber(searchParams.get("distiller"));
  const status = parseStatus(searchParams.get("status"));
  const input = {
    brand,
    collection: "library" as const,
    cursor,
    distiller,
    limit: 25,
    query,
    status,
    user: user.id,
  };
  const libraryQueryOptions = orpc.collections.bottles.list.queryOptions({
    input,
  });
  const libraryListQueryKey = orpc.collections.bottles.list.key({
    type: "query",
  });
  const libraryQuery = useQuery(libraryQueryOptions);
  const statsQuery = useQuery(
    orpc.users.libraryStats.queryOptions({ input: { user: user.id } }),
  );
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

  function setFilter(name: "brand" | "distiller" | "status", value: string) {
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
    <>
      <MemberLibraryFilters
        groups={filters}
        mode="mobile"
        onChange={setFilter}
        onClear={clearFilters}
        onQuerySubmit={setQuery}
        query={query}
        total={statsQuery.data?.total}
      />
      <PageColumns rail={filterPanel}>
        <div aria-busy={isNavigating || mutationPending || undefined}>
          {mutationError ? (
            <p role="alert" {...stylex.props(styles.actionError)}>
              The library change failed. Try the action again.
            </p>
          ) : null}
          {libraryQuery.isPending ? (
            <LoadingRecordList label="Loading member library" rows={4} />
          ) : libraryQuery.error ? (
            <ModuleError
              heading="Library is unavailable"
              onRetry={() => void libraryQuery.refetch()}
            >
              The member profile is still available. Try loading the Library
              again.
            </ModuleError>
          ) : (
            <MemberLibraryList
              emptyAction={
                isCurrentUser &&
                !hasActiveFilters({ brand, distiller, query, status }) ? (
                  <ButtonLink href="/addBottle" size="sm" variant="accent">
                    Add your first bottle
                  </ButtonLink>
                ) : undefined
              }
              emptyDescription={
                hasActiveFilters({ brand, distiller, query, status })
                  ? "No library bottles match these filters."
                  : isCurrentUser
                    ? "Track what you own, what you have finished, and what you want to open next."
                    : `${user.username} has not recorded any library bottles.`
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
              previousHref={getCursorHref(
                pathname,
                searchParams,
                libraryQuery.data.rel.prevCursor,
              )}
              total={statsQuery.data?.total}
            />
          )}
        </div>
      </PageColumns>
    </>
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
    actions: canEdit
      ? [
          {
            items: [
              {
                href: `/bottles/${bottle.id}/addTasting`,
                label: "Record a tasting",
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
    brand: bottle.brand.shortName || bottle.brand.name,
    brandHref: `/entities/${bottle.brand.id}`,
    href: `/bottles/${bottle.id}`,
    id: String(entry.id),
    imageUrl: entry.imageUrl ?? bottle.imageUrl,
    metadata: getLibraryMetadata(bottle),
    name: getBottleExpressionName(bottle),
    status: entry.status ? capitalize(entry.status) : undefined,
  };
}

function getLibraryMetadata(bottle: LibraryEntry["bottle"]) {
  return [
    bottle.category ? formatCategoryName(bottle.category) : null,
    bottle.statedAge !== null
      ? `${bottle.statedAge} years`
      : bottle.noAgeStatement
        ? "NAS"
        : null,
    bottle.abv !== null
      ? `${bottle.abv.toFixed(1).replace(/\.0$/, "")}% ABV`
      : null,
  ].filter((value): value is string => Boolean(value));
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

function positiveNumber(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseStatus(
  value: string | null,
): LibraryStatus | "unset" | undefined {
  return value && statusValues.has(value)
    ? value === "unset"
      ? "unset"
      : value === "open" || value === "sealed" || value === "empty"
        ? value
        : undefined
    : undefined;
}

function getCursorHref(
  pathname: string,
  searchParams: URLSearchParams,
  cursor?: number | null,
) {
  if (cursor === null || cursor === undefined) return undefined;
  const next = new URLSearchParams(searchParams);
  next.set("cursor", String(cursor));
  return `${pathname}?${next.toString()}`;
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
    fontFamily: fonts.reading,
    fontSize: "13px",
  },
});
